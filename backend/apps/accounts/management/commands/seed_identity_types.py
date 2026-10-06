"""Seed IdentityType rows used by damiin registration (old Settings.IdentityType)."""

from django.core.management.base import BaseCommand

from apps.accounts.models.user import IdentityType

DEFAULT_TYPES = (
    "Aqoonsi Qaran",
    "Baasaboorka",
    "Lambarka Taleefanka",
    "Kaarka Dhalashada",
    "Aqoonsi Kale",
)


class Command(BaseCommand):
    help = "Seed identity type lookup rows."

    def handle(self, *args, **options):
        created = 0
        for name in DEFAULT_TYPES:
            _, was_created = IdentityType.objects.get_or_create(name=name)
            if was_created:
                created += 1
        self.stdout.write(self.style.SUCCESS(f"Identity types ready ({created} new)."))
