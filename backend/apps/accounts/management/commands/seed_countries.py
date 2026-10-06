"""Seed Country rows (old Settings.Country)."""

from django.core.cache import cache
from django.core.management.base import BaseCommand

from apps.accounts.models.user import Country
from apps.core.cache import make_cache_key

DEFAULT_COUNTRIES = (
    "Somalia",
    "Kenya",
    "Ethiopia",
    "Djibouti",
    "Yemen",
    "United Arab Emirates",
    "Saudi Arabia",
    "Turkey",
    "United Kingdom",
    "United States",
)


class Command(BaseCommand):
    help = "Seed country lookup rows."

    def handle(self, *args, **options):
        created = 0
        for name in DEFAULT_COUNTRIES:
            _, was_created = Country.objects.get_or_create(name=name)
            if was_created:
                created += 1
        cache.delete(make_cache_key("legacy", "countries"))
        self.stdout.write(self.style.SUCCESS(f"Countries ready ({created} new)."))
