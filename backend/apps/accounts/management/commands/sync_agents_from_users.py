"""Create Agent profiles for users flagged is_agent but missing agent_profile."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Agent
from apps.accounts.services.agent_from_user import ensure_agent_profile_for_user

User = get_user_model()


class Command(BaseCommand):
    help = "Backfill Agent rows from User accounts where is_agent=True and no agent_profile exists."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report how many profiles would be created without writing.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        users = (
            User.objects.filter(is_agent=True, agent_profile__isnull=True)
            .select_related("county", "directorate")
            .order_by("id")
        )
        total = users.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("No agent users need syncing."))
            return

        if dry_run:
            self.stdout.write(f"Would create {total} agent profile(s).")
            return

        used_phones: set[str] = set(Agent.objects.values_list("phone", flat=True))
        created = 0

        with transaction.atomic():
            for user in users.iterator(chunk_size=200):
                if ensure_agent_profile_for_user(user, used_phones=used_phones):
                    created += 1

        self.stdout.write(self.style.SUCCESS(f"Created {created} agent profile(s) from {total} user(s)."))
