"""
Backfill SuspectFaceEmbedding from existing suspect photos.

Safe / easy defaults:
  - Only missing embeddings (skip already stored)
  - Limit batch size
  - Skip bad/missing photos without aborting
  - Dry-run support

Examples:
  python manage.py backfill_face_embeddings --limit=50
  python manage.py backfill_face_embeddings --limit=100 --dry-run
  python manage.py backfill_face_embeddings --limit=200 --force
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.suspects.face_embedder import FaceEmbedError, embed_suspect_photo, model_path
from apps.suspects.face_service import store_suspect_embedding
from apps.suspects.models import Suspect, SuspectFaceEmbedding


class Command(BaseCommand):
    help = "Backfill face embeddings from suspect photos (batch, skip errors)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=50,
            help="Max suspects to process this run (default 50).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Resolve photos / embed but do not write DB.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-embed even if SuspectFaceEmbedding already exists.",
        )
        parser.add_argument(
            "--offset",
            type=int,
            default=0,
            help="Skip first N candidates (for manual resume).",
        )
        parser.add_argument(
            "--source",
            type=str,
            default="",
            help="Optional Suspect.source filter (e.g. amniga, baaris).",
        )

    def handle(self, *args, **options):
        limit = max(1, int(options["limit"]))
        dry_run = bool(options["dry_run"])
        force = bool(options["force"])
        offset = max(0, int(options["offset"]))
        source = (options.get("source") or "").strip()

        path = model_path()
        if not path.is_file():
            self.stderr.write(self.style.ERROR(f"Model missing: {path}"))
            return

        qs = Suspect.objects.exclude(Q(photo_url="") | Q(photo_url__isnull=True)).order_by("id")
        if source:
            qs = qs.filter(source=source)
        if not force:
            qs = qs.filter(face_embedding__isnull=True)

        total_candidates = qs.count()
        batch = list(qs[offset : offset + limit])

        self.stdout.write(
            f"Candidates without embedding (or all if --force): {total_candidates} | "
            f"this run: {len(batch)} (offset={offset}, limit={limit})"
            + (" [DRY-RUN]" if dry_run else "")
        )

        ok = skip = fail = 0
        for i, suspect in enumerate(batch, start=1):
            label = f"[{i}/{len(batch)}] id={suspect.pk}"
            try:
                vector = embed_suspect_photo(suspect)
                if dry_run:
                    self.stdout.write(f"  {label} OK embed dim={len(vector)} (dry-run)")
                    ok += 1
                    continue
                store_suspect_embedding(suspect_id=suspect.pk, vector=vector)
                self.stdout.write(self.style.SUCCESS(f"  {label} stored dim={len(vector)}"))
                ok += 1
            except FaceEmbedError as exc:
                self.stdout.write(self.style.WARNING(f"  {label} skip: {exc}"))
                skip += 1
            except Exception as exc:  # noqa: BLE001 — keep batch alive
                self.stdout.write(self.style.ERROR(f"  {label} fail: {exc}"))
                fail += 1

        remaining = max(0, total_candidates - len(batch)) if not force else max(0, total_candidates - offset - len(batch))
        stored = SuspectFaceEmbedding.objects.count()
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. ok={ok} skip={skip} fail={fail} | "
                f"embeddings_total={stored} | remaining≈{remaining}"
            )
        )
        if remaining > 0:
            if force:
                next_offset = offset + len(batch)
                self.stdout.write(
                    f"Next: python manage.py backfill_face_embeddings --limit={limit} --offset={next_offset} --force"
                )
            else:
                self.stdout.write(
                    f"Next: python manage.py backfill_face_embeddings --limit={limit}"
                )
