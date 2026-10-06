from django.core.management.base import BaseCommand

from apps.hubkadhigis.services.lookups import seed_lookup_tables


class Command(BaseCommand):
    help = "Seed hubkadhigis lookup tables (ranks, force units, weapon types, surrender locations)."

    def handle(self, *args, **options):
        created = seed_lookup_tables()
        self.stdout.write(self.style.SUCCESS(f"Hubkadhigis lookups ready — {created} new rows."))
