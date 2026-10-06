"""
Transition database from the legacy apps.users model to apps.accounts.

Preserves suspects, forces, and other domain data. Drops old user tables and
re-applies accounts, admin, and token_blacklist migrations.

Usage:
    python manage.py transition_from_users
    python manage.py transition_from_users --no-input
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Migrate from legacy users.User to accounts.User without wiping domain data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-input",
            action="store_true",
            help="Skip confirmation prompt.",
        )

    def handle(self, *args, **options):
        if not options["no_input"]:
            confirm = input(
                "This drops legacy user tables and re-runs accounts migrations. Continue? [y/N] "
            )
            if confirm.lower() not in ("y", "yes"):
                self.stdout.write("Aborted.")
                return

        with connection.cursor() as cursor:
            cursor.execute("DROP TABLE IF EXISTS django_admin_log CASCADE")
            cursor.execute("DROP TABLE IF EXISTS token_blacklist_blacklistedtoken CASCADE")
            cursor.execute("DROP TABLE IF EXISTS token_blacklist_outstandingtoken CASCADE")
            cursor.execute("DROP TABLE IF EXISTS users_user_user_permissions CASCADE")
            cursor.execute("DROP TABLE IF EXISTS users_user_groups CASCADE")
            cursor.execute("DROP TABLE IF EXISTS users_user CASCADE")
            cursor.execute(
                "DELETE FROM django_migrations WHERE app IN ('users', 'admin', 'token_blacklist')"
            )
            cursor.execute(
                "DELETE FROM auth_permission WHERE content_type_id IN "
                "(SELECT id FROM django_content_type WHERE app_label = 'users')"
            )
            cursor.execute("DELETE FROM django_content_type WHERE app_label = 'users'")

        self.stdout.write(self.style.WARNING("Legacy user tables removed. Running migrations…"))
        call_command("migrate", verbosity=1)
        call_command("seed_admin", verbosity=1)
        self.stdout.write(self.style.SUCCESS("Transition complete. Default admin: admin@lmsbr.local / admin12345"))
