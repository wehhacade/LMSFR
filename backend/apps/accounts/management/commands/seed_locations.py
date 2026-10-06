"""Seed regions, counties, and sub-counties from production legacy data."""

from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.data.legacy_locations import COUNTIES, REGIONS
from apps.accounts.models import County, Region, SubCounty

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
SUB_COUNTIES_JSON = DATA_DIR / "legacy_sub_counties.json"


class Command(BaseCommand):
    help = "Seed Region, County, SubCounty with integer ids (legacy MySQL ids)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete all sub-counties, counties, and regions before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["flush"]:
            SubCounty.objects.all().delete()
            County.objects.all().delete()
            Region.objects.all().delete()
            self.stdout.write("Cleared existing location rows.")

        region_map: dict[int, Region] = {}
        for region_id, name, code, desc in REGIONS:
            region, _ = Region.objects.update_or_create(
                pk=region_id,
                defaults={"name": name, "code": code, "description": desc},
            )
            region_map[region_id] = region

        county_map: dict[int, County] = {}
        counties_created = 0
        for county_id, name, code, desc, region_id in COUNTIES:
            region = region_map.get(region_id)
            county, created = County.objects.update_or_create(
                pk=county_id,
                defaults={
                    "name": name,
                    "code": code,
                    "description": desc,
                    "region": region,
                },
            )
            county_map[county_id] = county
            if created:
                counties_created += 1

        if not SUB_COUNTIES_JSON.exists():
            self.stdout.write(self.style.WARNING(f"Missing {SUB_COUNTIES_JSON} — sub-counties skipped."))
            sub_rows = []
        else:
            sub_rows = json.loads(SUB_COUNTIES_JSON.read_text(encoding="utf-8"))

        sub_created = 0
        sub_skipped = 0
        for sub_id, code, name, desc, county_id in sub_rows:
            county = county_map.get(county_id)
            if not county:
                sub_skipped += 1
                continue
            if not name.strip():
                continue
            _, created = SubCounty.objects.update_or_create(
                pk=sub_id,
                defaults={
                    "name": name.strip(),
                    "code": code or "",
                    "description": desc or "",
                    "county": county,
                },
            )
            if created:
                sub_created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Locations ready — regions: {Region.objects.count()}, "
                f"counties: {County.objects.count()} (+{counties_created} new), "
                f"sub-counties: {SubCounty.objects.count()} (+{sub_created} new, {sub_skipped} skipped)."
            )
        )
