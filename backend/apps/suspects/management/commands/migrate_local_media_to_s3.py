"""Upload local MEDIA_ROOT files to S3 and rewrite DB photo paths.

Run after enabling USE_S3 / AWS_* credentials:

  python manage.py migrate_local_media_to_s3
  python manage.py migrate_local_media_to_s3 --dry-run
  python manage.py migrate_local_media_to_s3 --delete-local
"""

from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.suspects.models import Damiinada, Suspect
from apps.suspects.photo_utils import (
    _s3_client,
    _s3_configured,
    normalize_legacy_media_key,
    use_s3_storage,
)


def _normalize_db_path(raw: str) -> str:
    key = normalize_legacy_media_key(raw)
    return key or (raw or "").lstrip("/")


class Command(BaseCommand):
    help = "Upload local /media files to S3 and point DB photo fields at S3 keys."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report only; do not upload or update.")
        parser.add_argument(
            "--delete-local",
            action="store_true",
            help="Delete local files after a successful S3 upload.",
        )
        parser.add_argument(
            "--prefix",
            default="",
            help="Only migrate keys under this prefix (e.g. suspects/).",
        )

    def handle(self, *args, **options):
        dry = bool(options["dry_run"])
        delete_local = bool(options["delete_local"])
        only_prefix = (options.get("prefix") or "").strip().lstrip("/")

        if not _s3_configured():
            raise CommandError("AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_STORAGE_BUCKET_NAME required.")
        if not use_s3_storage() and not dry:
            self.stdout.write(self.style.WARNING(
                "USE_S3 is False — uploads will still go to the bucket via boto3, "
                "but new Django saves stay local until USE_S3 is enabled."
            ))

        media_root = Path(settings.MEDIA_ROOT)
        if not media_root.exists():
            raise CommandError(f"MEDIA_ROOT does not exist: {media_root}")

        bucket = settings.AWS_STORAGE_BUCKET_NAME
        client = _s3_client()

        files = [p for p in media_root.rglob("*") if p.is_file()]
        if only_prefix:
            files = [p for p in files if str(p.relative_to(media_root)).replace("\\", "/").startswith(only_prefix)]

        uploaded = 0
        skipped = 0
        failed = 0
        for path in files:
            key = str(path.relative_to(media_root)).replace("\\", "/")
            if dry:
                self.stdout.write(f"DRY would upload {key}")
                uploaded += 1
                continue
            try:
                extra: dict[str, str] = {}
                suffix = path.suffix.lower()
                if suffix in {".jpg", ".jpeg"}:
                    extra["ContentType"] = "image/jpeg"
                elif suffix == ".png":
                    extra["ContentType"] = "image/png"
                elif suffix == ".webp":
                    extra["ContentType"] = "image/webp"
                with path.open("rb") as fh:
                    if extra:
                        client.upload_fileobj(fh, bucket, key, ExtraArgs=extra)
                    else:
                        client.upload_fileobj(fh, bucket, key)
                uploaded += 1
                self.stdout.write(self.style.SUCCESS(f"uploaded s3://{bucket}/{key}"))
                if delete_local:
                    path.unlink(missing_ok=True)
            except Exception as exc:
                failed += 1
                self.stdout.write(self.style.ERROR(f"FAIL {key}: {exc}"))

        rewritten = self._rewrite_db_paths(dry=dry)
        self.stdout.write(self.style.SUCCESS(
            f"Done. uploaded={uploaded} skipped={skipped} failed={failed} db_rewritten={rewritten} dry_run={dry}"
        ))

    def _rewrite_db_paths(self, *, dry: bool) -> int:
        """Turn /media/suspects/… into suspects/… so resolve_photo_url presigns S3."""
        updates: list[tuple[type, int, str, str]] = []

        for model, fields in (
            (Suspect, ("photo_url",)),
            (Damiinada, ("picture_url", "identity_picture_url")),
        ):
            for field in fields:
                qs = model.objects.exclude(**{field: ""}).exclude(**{f"{field}__isnull": True})
                for row in qs.only("pk", field).iterator():
                    raw = (getattr(row, field) or "").strip()
                    if not raw:
                        continue
                    key = _normalize_db_path(raw)
                    if not key or key == raw:
                        continue
                    updates.append((model, row.pk, field, key))

        if dry:
            for model, pk, field, key in updates:
                self.stdout.write(f"DRY would set {model.__name__}.{pk}.{field} -> {key}")
            return len(updates)

        with transaction.atomic():
            for model, pk, field, key in updates:
                model.objects.filter(pk=pk).update(**{field: key})
                self.stdout.write(f"DB {model.__name__}#{pk}.{field} -> {key}")
        return len(updates)
