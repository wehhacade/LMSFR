"""
Truncate legacy tables (empty data, reset id sequence).

Usage:
  python manage.py truncate_legacy users
  python manage.py truncate_legacy region county sub-county
  python manage.py truncate_legacy locations
  make truncate-users
  make truncate-locations
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from apps.core.legacy_import.registry import all_legacy_tables
from apps.core.legacy_import.truncate import TABLE_GROUPS, truncate_tables


class Command(BaseCommand):
    help = "TRUNCATE legacy table(s) — make truncate-<table>"

    def add_arguments(self, parser):
        parser.add_argument(
            "tables",
            nargs="*",
            help="Table name(s): users, region, county, sub-county, locations, …",
        )
        parser.add_argument(
            "--list",
            action="store_true",
            help="Show common truncate targets",
        )

    def handle(self, *args, **options):
        if options["list"] or not options["tables"]:
            self._print_list()
            if not options["tables"]:
                return

        names = list(options["tables"])
        try:
            truncated = truncate_tables(names)
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.WARNING(
                "Truncated — " + ", ".join(truncated)
            )
        )

    def _print_list(self) -> None:
        self.stdout.write("Truncate: make truncate-<table>\n")
        self.stdout.write("  make truncate-users\n")
        self.stdout.write("  make truncate-region\n")
        self.stdout.write("  make truncate-county\n")
        self.stdout.write("  make truncate-subcounty\n")
        self.stdout.write("  make truncate-locations     (region + county + sub-county)\n")
        self.stdout.write("  make truncate-auth-groups   (users_groups + auth_group_permissions + auth_group)\n")
        self.stdout.write("  make truncate-legacy table=suspects\n\n")
        self.stdout.write("Groups:\n")
        for alias, tables in TABLE_GROUPS.items():
            if alias != "location":
                self.stdout.write(f"  {alias:16} → {', '.join(tables)}\n")
        self.stdout.write("\nAll db_tables:\n")
        for entry in all_legacy_tables()[:20]:
            self.stdout.write(f"  {entry['table']}\n")
        self.stdout.write("  …\n")
