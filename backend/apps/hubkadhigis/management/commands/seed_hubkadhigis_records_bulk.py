"""
Bulk-insert hubkadhigis records for load / performance testing.

Usage:
    python manage.py seed_hubkadhigis_records_bulk --count 50000
    python manage.py seed_hubkadhigis_records_bulk --count 1000 --with-images
    python manage.py seed_hubkadhigis_records_bulk --flush-perf
"""

from __future__ import annotations

import random
import time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import County
from apps.core.cache import invalidate_cache
from apps.hubkadhigis.models import DisarmamentImage, DisarmamentRecord
from apps.hubkadhigis.seed_utils import (
    PERF_PHONE_PREFIX,
    LookupBundle,
    attach_record_images,
    bulk_record_kwargs,
)
from apps.hubkadhigis.services.records import assign_reference_number

User = get_user_model()

DEFAULT_BATCH = 2000


class Command(BaseCommand):
    help = "Bulk seed hubkadhigis records for performance testing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=50_000,
            help="Number of records to create (default: 50000).",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=DEFAULT_BATCH,
            help=f"Insert batch size (default: {DEFAULT_BATCH}).",
        )
        parser.add_argument(
            "--days-back",
            type=int,
            default=365,
            help="Spread surrender_date over this many days (default: 365).",
        )
        parser.add_argument(
            "--with-images",
            action="store_true",
            help="Attach person, cover, and one gallery image per row (much slower).",
        )
        parser.add_argument(
            "--flush-perf",
            action="store_true",
            help=f"Delete perf rows (phone prefix {PERF_PHONE_PREFIX!r}) and exit.",
        )

    def handle(self, *args, **options):
        if options["flush_perf"]:
            perf_ids = list(
                DisarmamentRecord.objects.filter(phone_number__startswith=PERF_PHONE_PREFIX).values_list("id", flat=True)
            )
            if perf_ids:
                DisarmamentImage.objects.filter(record_id__in=perf_ids).delete()
            deleted, breakdown = DisarmamentRecord.objects.filter(
                phone_number__startswith=PERF_PHONE_PREFIX
            ).delete()
            self.stdout.write(self.style.WARNING(f"Removed {deleted} perf objects ({breakdown})."))
            invalidate_cache("hubkadhigis")
            return

        count = max(0, options["count"])
        if count == 0:
            self.stdout.write("Nothing to do (--count 0).")
            return

        if County.objects.count() == 0:
            self.stderr.write(self.style.WARNING("Run seed_locations first for county FK data."))

        admin = (
            User.objects.filter(is_admin=True, is_active=True).order_by("id").first()
            or User.objects.filter(is_superuser=True).order_by("id").first()
        )
        if not admin:
            self.stderr.write(self.style.ERROR("No admin user found."))
            return

        bundle = LookupBundle.load()
        if not bundle.weapon_types:
            self.stderr.write(self.style.ERROR("Run seed_hubkadhigis_lookups first."))
            return

        batch_size = max(200, options["batch_size"])
        days_back = max(7, options["days_back"])
        with_images = options["with_images"]
        rng = random.Random(99_001)

        if with_images:
            self._seed_with_images(count, bundle, admin, rng, days_back)
            return

        start = time.perf_counter()
        inserted = 0
        year = timezone.now().year

        for batch_start in range(0, count, batch_size):
            batch_end = min(batch_start + batch_size, count)
            rows: list[DisarmamentRecord] = []
            for seq in range(batch_start, batch_end):
                rows.append(
                    DisarmamentRecord(**bulk_record_kwargs(
                        bundle=bundle,
                        admin_user=admin,
                        rng=rng,
                        seq=seq + 1,
                        days_back=days_back,
                    ))
                )
            created = DisarmamentRecord.objects.bulk_create(rows, batch_size=batch_size)
            refs = [f"HG-{year}-{r.pk:05d}" for r in created]
            for record, ref in zip(created, refs, strict=True):
                record.reference_number = ref
            DisarmamentRecord.objects.bulk_update(created, ["reference_number"], batch_size=batch_size)
            inserted += len(created)
            self.stdout.write(f"  … {inserted:,} / {count:,}", ending="\r")

        elapsed = time.perf_counter() - start
        rate = inserted / elapsed if elapsed > 0 else 0
        invalidate_cache("hubkadhigis")
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Inserted {inserted:,} perf records in {elapsed:.1f}s (~{rate:,.0f}/s)."
            )
        )

    def _seed_with_images(self, count: int, bundle: LookupBundle, admin, rng: random.Random, days_back: int):
        start = time.perf_counter()
        for seq in range(count):
            record = DisarmamentRecord(**bulk_record_kwargs(
                bundle=bundle,
                admin_user=admin,
                rng=rng,
                seq=seq + 1,
                days_back=days_back,
            ))
            record.save()
            assign_reference_number(record)

            attach_record_images(record, admin_user=admin, rng=rng, with_gallery=True)
            if (seq + 1) % 50 == 0 or seq + 1 == count:
                self.stdout.write(f"  … {seq + 1:,} / {count:,} with images", ending="\r")

        elapsed = time.perf_counter() - start
        invalidate_cache("hubkadhigis")
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(f"Inserted {count:,} perf records with images in {elapsed:.1f}s.")
        )
