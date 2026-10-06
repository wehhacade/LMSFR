"""Enroll existing suspect photos into the InsightFace suspects collection."""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from apps.suspects.face_embedder import FaceEmbedError, resolve_suspect_photo_bytes
from apps.suspects.insightface.client import configured
from apps.suspects.insightface.service import enroll_suspect_image, insightface_enabled
from apps.suspects.models import Suspect


class Command(BaseCommand):
    help = "Enroll suspect photos into InsightFace (lmsbr-suspects)."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=50)
        parser.add_argument("--offset", type=int, default=0)
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--source", type=str, default="")

    def handle(self, *args, **options):
        if not configured() or not insightface_enabled():
            raise CommandError("InsightFace is not configured (URL + API key).")

        limit = max(1, int(options["limit"]))
        offset = max(0, int(options["offset"]))
        dry_run = bool(options["dry_run"])
        source = (options.get("source") or "").strip()

        qs = Suspect.objects.exclude(Q(photo_url="") | Q(photo_url__isnull=True)).order_by("id")
        if source:
            qs = qs.filter(source=source)
        total = qs.count()
        batch = list(qs[offset : offset + limit])
        self.stdout.write(
            f"Suspects with photos: {total} | this run: {len(batch)} "
            f"(offset={offset}, limit={limit})" + (" [DRY-RUN]" if dry_run else "")
        )

        ok = skip = fail = 0
        for i, suspect in enumerate(batch, start=1):
            label = f"[{i}/{len(batch)}] id={suspect.pk}"
            try:
                image = resolve_suspect_photo_bytes(suspect)
                if not image:
                    self.stdout.write(self.style.WARNING(f"  {label} skip: photo bytes missing"))
                    skip += 1
                    continue
                if dry_run:
                    self.stdout.write(f"  {label} would enroll {len(image)} bytes")
                    ok += 1
                    continue
                result = enroll_suspect_image(suspect.pk, image)
                if result.get("ok"):
                    self.stdout.write(self.style.SUCCESS(f"  {label} enrolled person={result.get('person_id')}"))
                    ok += 1
                else:
                    self.stdout.write(self.style.WARNING(f"  {label} skip: {result.get('reason')}"))
                    skip += 1
            except FaceEmbedError as exc:
                self.stdout.write(self.style.WARNING(f"  {label} skip: {exc}"))
                skip += 1
            except Exception as exc:  # noqa: BLE001 — keep batch alive
                self.stdout.write(self.style.ERROR(f"  {label} fail: {exc}"))
                fail += 1

        remaining = max(0, total - offset - len(batch))
        self.stdout.write(self.style.SUCCESS(f"Done. ok={ok} skip={skip} fail={fail} remaining≈{remaining}"))
        if remaining > 0:
            self.stdout.write(
                f"Next: python manage.py enroll_insightface_suspects --limit={limit} --offset={offset + len(batch)}"
            )
