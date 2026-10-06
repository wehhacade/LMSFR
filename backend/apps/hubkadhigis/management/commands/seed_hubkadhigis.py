"""
Seed complete hubkadhigis demo records (all fields + images).

Usage:
    python manage.py seed_hubkadhigis
    python manage.py seed_hubkadhigis --flush
"""

from __future__ import annotations

import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import County
from apps.core.cache import invalidate_cache
from apps.hubkadhigis.models import DisarmamentImage, DisarmamentRecord
from apps.hubkadhigis.seed_utils import (
    DEMO_PHONE_PREFIX,
    LookupBundle,
    create_demo_record,
)

User = get_user_model()

DEMO_HANDED_OVER = 28
DEMO_REGISTERED_ONLY = 4


class Command(BaseCommand):
    help = "Seed complete hubkadhigis demo records with images for UI testing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help=f"Delete demo rows (phone prefix {DEMO_PHONE_PREFIX!r}) before seeding.",
        )

    def handle(self, *args, **options):
        if options["flush"]:
            self._flush_demo()

        if County.objects.count() == 0:
            self.stderr.write(
                self.style.WARNING("No counties found — run: python manage.py seed_locations")
            )

        admin = (
            User.objects.filter(is_admin=True, is_active=True).order_by("id").first()
            or User.objects.filter(is_superuser=True).order_by("id").first()
        )
        if not admin:
            self.stderr.write(self.style.ERROR("No admin user found. Create a user first."))
            return

        bundle = LookupBundle.load()
        if not bundle.weapon_types or not bundle.force_units:
            self.stderr.write(self.style.ERROR("Lookups missing. Run: python manage.py seed_hubkadhigis_lookups"))
            return

        existing = DisarmamentRecord.objects.filter(phone_number__startswith=DEMO_PHONE_PREFIX).count()
        if existing and not options["flush"]:
            self.stdout.write(
                self.style.WARNING(
                    f"{existing} demo records already exist. Use --flush to replace them."
                )
            )
            return

        rng = random.Random(42)
        created = 0
        with transaction.atomic():
            for i in range(DEMO_HANDED_OVER):
                create_demo_record(
                    bundle=bundle,
                    admin_user=admin,
                    rng=rng,
                    index=i,
                    registered_only=False,
                )
                created += 1
            for i in range(DEMO_REGISTERED_ONLY):
                create_demo_record(
                    bundle=bundle,
                    admin_user=admin,
                    rng=rng,
                    index=DEMO_HANDED_OVER + i,
                    registered_only=True,
                )
                created += 1

        invalidate_cache("hubkadhigis")
        self.stdout.write(
            self.style.SUCCESS(
                f"Hubkadhigis demo ready — {created} records "
                f"({DEMO_HANDED_OVER} handed over with images, {DEMO_REGISTERED_ONLY} registered only)."
            )
        )

    def _flush_demo(self):
        demo_ids = list(
            DisarmamentRecord.objects.filter(phone_number__startswith=DEMO_PHONE_PREFIX).values_list("id", flat=True)
        )
        if not demo_ids:
            self.stdout.write("No demo records to remove.")
            return
        DisarmamentImage.objects.filter(record_id__in=demo_ids).delete()
        deleted, breakdown = DisarmamentRecord.objects.filter(id__in=demo_ids).delete()
        self.stdout.write(self.style.WARNING(f"Removed {deleted} demo objects ({breakdown})."))
        invalidate_cache("hubkadhigis")
