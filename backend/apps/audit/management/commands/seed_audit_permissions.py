"""Assign audit/error/traffic view permissions to admin groups."""

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from apps.audit.models import APITrafficLog, AuditTrail, ErrorLog


PERM_CODENAMES = [
    "view_audittrail",
    "view_audit_report",
    "export_audittrail",
    "view_errorlog",
    "export_errorlog",
    "view_apitrafficlog",
    "export_apitrafficlog",
]


class Command(BaseCommand):
    help = "Grant audit module permissions to Ilaalo-Shacab and staff admin groups."

    def handle(self, *args, **options):
        perms = Permission.objects.filter(
            codename__in=PERM_CODENAMES,
            content_type__app_label="audit",
        )
        if not perms.exists():
            self.stdout.write(self.style.WARNING("Run migrate first — no audit permissions found."))
            return

        for name in ("Ilaalo-Shacab",):
            group, _ = Group.objects.get_or_create(name=name)
            group.permissions.add(*perms)
            self.stdout.write(self.style.SUCCESS(f"Added {perms.count()} audit perms to '{name}'"))

        self.stdout.write(self.style.SUCCESS("Audit permissions seeded."))
