"""Grant personnel module permissions to admin and operator groups."""

from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

PERSONNEL_PERMS = (
    "attendance_view",
    "attendance_create",
    "attendance_update",
    "agent_transfer",
    "restriction_view",
    "restriction_create",
    "restriction_update",
    "restriction_release",
    "agent_import",
    "agent_import_review",
    "agent_import_apply",
    "agent_status_manage",
)

GROUP_NAMES = ("NISA Admin", "Personnel Operators")


class Command(BaseCommand):
    help = "Assign personnel CRUD/transfer/import permissions to admin groups."

    def handle(self, *args, **options):
        perms = list(
            Permission.objects.filter(
                content_type__app_label="personnel",
                codename__in=PERSONNEL_PERMS,
            )
        )
        if len(perms) != len(PERSONNEL_PERMS):
            self.stderr.write(
                self.style.WARNING(
                    f"Run migrate first — found {len(perms)}/{len(PERSONNEL_PERMS)} personnel permissions."
                )
            )
            return

        for name in GROUP_NAMES:
            group, created = Group.objects.get_or_create(name=name)
            group.permissions.add(*perms)
            tag = "created" if created else "updated"
            self.stdout.write(f"  {name} ({tag}) — {len(perms)} permissions")

        self.stdout.write(self.style.SUCCESS("Personnel permissions seeded."))
