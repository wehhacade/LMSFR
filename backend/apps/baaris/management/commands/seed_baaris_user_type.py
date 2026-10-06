from django.core.management.base import BaseCommand

from apps.accounts.models import UserType


class Command(BaseCommand):
    help = "Ensure UserType 'baaris' exists for TipPhone Baaris agents."

    def handle(self, *args, **options):
        obj, created = UserType.objects.get_or_create(
            name="baaris",
            defaults={"code": "BAR"},
        )
        if created:
            self.stdout.write(self.style.SUCCESS("Created UserType baaris"))
        else:
            self.stdout.write(f"UserType baaris already exists (id={obj.pk})")
