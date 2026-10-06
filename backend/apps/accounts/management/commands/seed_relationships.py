"""Seed relationship lookup rows (old relationship table)."""

from django.core.management.base import BaseCommand
from django.db import connection

from apps.accounts.models import Relationship

DEFAULT_RELATIONSHIPS = (
    (1, "Walaal"),
    (2, "Hooyo"),
    (3, "Aabo"),
    (4, "Adeer"),
    (5, "Abti"),
    (6, "Edo"),
    (7, "Habo"),
    (8, "Masuul (Aqoonsi wata)"),
    (9, "Lamaane"),
    (10, "Caruur"),
)


class Command(BaseCommand):
    help = "Seed Relationship rows with legacy ids 1–10."

    def handle(self, *args, **options):
        created = 0
        for pk, name in DEFAULT_RELATIONSHIPS:
            _, was_created = Relationship.objects.update_or_create(id=pk, defaults={"relationship": name})
            if was_created:
                created += 1

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT setval(pg_get_serial_sequence('relationship', 'id'), "
                "(SELECT COALESCE(MAX(id), 1) FROM relationship))"
            )

        self.stdout.write(
            self.style.SUCCESS(f"Relationships ready — {created} new, {Relationship.objects.count()} total.")
        )
