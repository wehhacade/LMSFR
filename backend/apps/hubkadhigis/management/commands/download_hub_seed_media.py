"""
Download real stock photos for hubkadhigis bulk seeding.

Person portraits: randomuser.me (dev/test portraits).
Weapon / evidence: Pexels stock photos (free license).

Usage:
    python manage.py download_hub_seed_media
    python manage.py download_hub_seed_media --person-count 150
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.hubkadhigis.seed_media_pool import download_seed_media, seed_media_ready


class Command(BaseCommand):
    help = "Download real person and weapon photos into the local hubkadhigis seed media pool."

    def add_arguments(self, parser):
        parser.add_argument(
            "--person-count",
            type=int,
            default=100,
            help="Target number of person portrait JPEGs to cache locally.",
        )

    def handle(self, *args, **options):
        if seed_media_ready():
            self.stdout.write(self.style.WARNING("Seed media pool already populated — re-downloading missing files only."))

        counts = download_seed_media(
            person_count=options["person_count"],
            write=self.stdout.write,
        )
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed media pool: {counts['persons']} person, "
                f"{counts['weapons']} weapon, {counts['evidence']} evidence photo(s).",
            ),
        )
