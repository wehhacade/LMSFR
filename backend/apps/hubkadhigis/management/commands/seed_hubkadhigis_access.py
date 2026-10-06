"""Grant hubkadhigis model permissions to the NISA Admin group (or all staff)."""

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from apps.hubkadhigis.models import DisarmamentRecord

HUB_PERMS = (
    "view_disarmamentrecord",
    "add_disarmamentrecord",
    "change_disarmamentrecord",
    "delete_disarmamentrecord",
)
GROUP_NAMES = ("NISA Admin", "Hubkadhigis Operators")


class Command(BaseCommand):
    help = "Assign hubkadhigis CRUD permissions to admin groups."

    def handle(self, *args, **options):
        ct = ContentType.objects.get_for_model(DisarmamentRecord)
        perms = list(
            Permission.objects.filter(content_type=ct, codename__in=HUB_PERMS)
        )
        if len(perms) != len(HUB_PERMS):
            self.stderr.write(self.style.WARNING("Run migrate first — hubkadhigis permissions missing."))
            return

        assigned = 0
        for name in GROUP_NAMES:
            group, created = Group.objects.get_or_create(name=name)
            group.permissions.add(*perms)
            assigned += 1
            tag = "created" if created else "updated"
            self.stdout.write(f"  {name} ({tag})")

        self.stdout.write(self.style.SUCCESS(f"Hubkadhigis access ready — {assigned} group(s) updated."))
