"""Offline dry-run or apply for agent roster Excel imports."""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.personnel.services.import_service import ImportParseError, import_agent_roster


class Command(BaseCommand):
    help = "Parse and reconcile an agent roster Excel file (dry-run by default)."

    def add_arguments(self, parser):
        parser.add_argument("file", type=str, help="Path to the Excel file")
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply changes to the database (requires no conflicts)",
        )
        parser.add_argument(
            "--department-scope",
            type=str,
            default="",
            help="Section/department name scope for missing-agent reconciliation",
        )
        parser.add_argument(
            "--user",
            type=str,
            default="",
            help="Username of the user performing the import (required for --apply)",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            help="Output full summary as JSON",
        )

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.is_file():
            raise CommandError(f"File not found: {path}")

        user = None
        if options["apply"]:
            from django.contrib.auth import get_user_model

            username = options["user"].strip()
            if not username:
                raise CommandError("--user is required when using --apply")
            User = get_user_model()
            user = User.objects.filter(username=username).first() or User.objects.filter(email=username).first()
            if not user:
                raise CommandError(f"User not found: {username}")

        with path.open("rb") as fh:
            try:
                summary = import_agent_roster(
                    fh,
                    user=user or self._system_user(),
                    filename=path.name,
                    dry_run=not options["apply"],
                    department_scope=options["department_scope"],
                )
            except ImportParseError as exc:
                raise CommandError(str(exc)) from exc

        if options["json"]:
            self.stdout.write(json.dumps(summary, indent=2, default=str))
            return

        self.stdout.write(self.style.SUCCESS(f"Source section: {summary.get('source_section', '')}"))
        self.stdout.write(f"Total rows: {summary.get('total_rows', 0)}")
        self.stdout.write(f"New agents: {summary.get('new_agents', 0)}")
        self.stdout.write(f"Existing agents: {summary.get('existing_agents', 0)}")
        self.stdout.write(f"District changes: {summary.get('district_changes', 0)}")
        self.stdout.write(f"Duplicates: {summary.get('duplicate_records', 0)}")
        self.stdout.write(f"Conflicts: {summary.get('conflicts', 0)}")
        self.stdout.write(f"Invalid: {summary.get('invalid_records', 0)}")
        self.stdout.write(f"Missing from Excel: {summary.get('missing_from_excel', 0)}")
        ready = summary.get("ready_to_apply", False)
        self.stdout.write(f"Ready to apply: {ready}")

        if summary.get("conflicts", 0):
            self.stdout.write(self.style.WARNING("\nConflicting service IDs:"))
            for row in summary.get("changes_preview", []):
                if row.get("errors"):
                    self.stdout.write(f"  {row['service_id']}: {', '.join(row['errors'])}")

        if options["apply"]:
            self.stdout.write(self.style.SUCCESS(f"\nApplied batch #{summary.get('batch_id')}"))
        elif not ready:
            self.stdout.write(self.style.WARNING("\nResolve conflicts before applying with --apply"))

    def _system_user(self):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        return User.objects.filter(is_superuser=True).order_by("pk").first()
