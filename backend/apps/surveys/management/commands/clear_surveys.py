"""
Delete survey data to clean the database.

Usage:
    python manage.py clear_surveys                 # delete the seeded demo surveys + their data
    python manage.py clear_surveys --all           # delete ALL surveys, responses, and answers
    python manage.py clear_surveys --responses     # delete only responses/answers (keep survey structure)
    python manage.py clear_surveys --all --responses  # delete every response (keep every survey structure)
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.cache import invalidate_cache
from apps.surveys.management.commands.seed_surveys import SEED_SURVEY_NAMES
from apps.surveys.models import Response, Survey


class Command(BaseCommand):
    help = "Delete survey seed data (or all survey data) to clean the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all",
            action="store_true",
            help="Delete ALL surveys/responses, not just the seeded demo data.",
        )
        parser.add_argument(
            "--responses",
            action="store_true",
            help="Delete only responses and answers; keep the survey structure.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        target_all = options["all"]
        scope = "all surveys" if target_all else "seeded demo surveys"

        if options["responses"]:
            responses = (
                Response.objects.all()
                if target_all
                else Response.objects.filter(survey__name__in=SEED_SURVEY_NAMES)
            )
            count = responses.count()
            deleted, _ = responses.delete()
            self.stdout.write(
                self.style.WARNING(
                    f"Deleted {count} responses ({deleted} related objects incl. answers) "
                    f"from {scope}."
                )
            )
        else:
            surveys = (
                Survey.objects.all()
                if target_all
                else Survey.objects.filter(name__in=SEED_SURVEY_NAMES)
            )
            count = surveys.count()
            deleted, _ = surveys.delete()
            self.stdout.write(
                self.style.WARNING(
                    f"Deleted {count} surveys ({deleted} related objects incl. sections, "
                    f"questions, choices, responses, answers) from {scope}."
                )
            )

        invalidate_cache("survey")
        self.stdout.write(self.style.SUCCESS("Survey data cleaned."))
