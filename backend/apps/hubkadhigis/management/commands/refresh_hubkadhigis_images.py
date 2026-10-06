"""
Regenerate person / weapon / gallery JPEGs for existing hubkadhigis records.

Usage:
    python manage.py refresh_hubkadhigis_images
    python manage.py refresh_hubkadhigis_images --prefix HUB-DEMO
    python manage.py refresh_hubkadhigis_images --limit 100 --no-gallery
"""

from __future__ import annotations

import random
import time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.core.cache import invalidate_cache
from apps.hubkadhigis.models import DisarmamentRecord
from apps.hubkadhigis.seed_media_pool import ensure_seed_media
from apps.hubkadhigis.seed_utils import attach_record_images

User = get_user_model()


class Command(BaseCommand):
    help = "Refresh hubkadhigis record images with real stock photos from the seed media pool."

    def add_arguments(self, parser):
        parser.add_argument(
            "--prefix",
            default="",
            help="Only records whose phone starts with this prefix (e.g. HUB-DEMO, HUB-PERF).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Max records to refresh (0 = all matching).",
        )
        parser.add_argument(
            "--no-gallery",
            action="store_true",
            help="Skip regenerating DisarmamentImage gallery rows.",
        )

    def handle(self, *args, **options):
        admin = User.objects.filter(is_superuser=True).order_by("id").first()
        if not admin:
            self.stderr.write(self.style.ERROR("No superuser found — create an admin user first."))
            return

        qs = DisarmamentRecord.objects.filter(
            Q(person_image__isnull=False) | Q(cover_image__isnull=False),
        ).select_related("weapon_type")

        prefix = (options["prefix"] or "").strip()
        if prefix:
            qs = qs.filter(phone_number__startswith=prefix)

        limit = options["limit"] or 0
        if limit > 0:
            qs = qs[:limit]

        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.WARNING("No records matched — nothing to refresh."))
            return

        rng = random.Random(42)
        start = time.perf_counter()
        self.stdout.write("Ensuring seed media pool (person + weapon photos)…")
        ensure_seed_media(write=self.stdout.write)
        self.stdout.write(f"Refreshing images for {total:,} record(s)…")

        for idx, record in enumerate(qs.iterator(chunk_size=100), start=1):
            attach_record_images(
                record,
                admin_user=admin,
                rng=rng,
                with_gallery=not options["no_gallery"],
                delete_old_files=False,
            )
            if idx % 50 == 0 or idx == total:
                self.stdout.write(f"  … {idx:,} / {total:,}", ending="\r")

        invalidate_cache("hubkadhigis")
        elapsed = time.perf_counter() - start
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(f"Refreshed {total:,} record image(s) in {elapsed:.1f}s."),
        )
