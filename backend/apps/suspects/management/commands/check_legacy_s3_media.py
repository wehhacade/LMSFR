"""Verify legacy suspect/damiin photos exist on S3 and can be presigned."""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from apps.suspects.models import Damiinada, Suspect
from apps.suspects.photo_utils import (
    _s3_configured,
    is_legacy_s3_key,
    normalize_legacy_media_key,
    presigned_s3_url,
    resolve_photo_url,
)


class Command(BaseCommand):
    help = "Check legacy S3 media keys for suspects/damiinada (requires AWS_* in .env)."

    def add_arguments(self, parser):
        parser.add_argument("--suspect-id", type=int, default=1)
        parser.add_argument("--damiin-id", type=int, default=16)

    def handle(self, *args, **options):
        if not _s3_configured():
            raise CommandError(
                "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_STORAGE_BUCKET_NAME "
                "must be set in .env (same credentials as old LMSBR S3 uploads)."
            )

        import boto3
        from django.conf import settings

        client = boto3.client(
            "s3",
            region_name=settings.AWS_S3_REGION_NAME,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

        for label, obj, field in (
            ("suspect", Suspect.objects.filter(pk=options["suspect_id"]).first(), "photo_url"),
            ("damiin", Damiinada.objects.filter(pk=options["damiin_id"]).first(), "picture_url"),
        ):
            if obj is None:
                self.stdout.write(self.style.WARNING(f"No {label} id={options[f'{label}_id']}"))
                continue
            raw = getattr(obj, field, "") or ""
            key = normalize_legacy_media_key(raw)
            self.stdout.write(f"\n{label} id={obj.pk}")
            self.stdout.write(f"  db: {raw[:100]}")
            self.stdout.write(f"  s3 key: {key}")
            if not is_legacy_s3_key(key):
                self.stdout.write(self.style.WARNING("  not a legacy S3 media path"))
                continue
            try:
                head = client.head_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
                self.stdout.write(self.style.SUCCESS(f"  S3 OK — size={head.get('ContentLength')} bytes"))
                signed = presigned_s3_url(key, expires_in=300)
                self.stdout.write(f"  presigned: {signed[:90]}…")
                self.stdout.write(f"  api resolve: {resolve_photo_url(raw)[:90]}…")
            except client.exceptions.ClientError as exc:
                code = exc.response.get("Error", {}).get("Code", "?")
                self.stdout.write(self.style.ERROR(f"  S3 error: {code}"))
