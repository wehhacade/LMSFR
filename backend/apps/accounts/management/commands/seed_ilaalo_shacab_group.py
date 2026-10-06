"""Create Ilaalo-Shacab group with field-operation permissions."""

from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand


# Permissions aligned with legacy Ilaalo-Shacab / public-guard operations.
CODENAMES = [
    "view_agent",
    "view_suspect",
    "add_suspect",
    "change_suspect",
    "view_daily_report",
    "view_special_case",
    "view_force",
    "view_user",
    "view_county",
]


class Command(BaseCommand):
    help = "Create or update the Ilaalo-Shacab group with standard permissions."

    def handle(self, *args, **options):
        group, created = Group.objects.get_or_create(name="Ilaalo-Shacab")
        perms = Permission.objects.filter(codename__in=CODENAMES)
        found = set(perms.values_list("codename", flat=True))
        missing = [c for c in CODENAMES if c not in found]
        group.permissions.set(perms)
        action = "Created" if created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} group '{group.name}' with {perms.count()} permissions."
            )
        )
        if missing:
            self.stdout.write(self.style.WARNING(f"Not found (run migrate first): {', '.join(missing)}"))
