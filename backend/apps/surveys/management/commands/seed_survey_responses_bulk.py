"""
Bulk-insert survey responses for load / performance testing.

Usage:
    python manage.py seed_survey_responses_bulk --count 100000
    python manage.py seed_survey_responses_bulk --count 100000 --with-answers
    python manage.py seed_survey_responses_bulk --flush-perf
    python manage.py seed_survey_responses_bulk --survey-id 3 --count 50000

Run seed_surveys first if you have no live surveys.
"""

from __future__ import annotations

import random
import time
from datetime import timedelta
from decimal import Decimal
from typing import NamedTuple

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from apps.core.cache import invalidate_cache
from apps.surveys.models import Answer, Question, Response, Survey

User = get_user_model()

PERF_PHONE_PREFIX = "PERF-"
DEFAULT_BATCH = 5000


class UserSeedRow(NamedTuple):
    pk: int
    phone: str
    county_id: int | None


class Command(BaseCommand):
    help = "Bulk seed survey responses for performance testing (default 100,000)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=100_000,
            help="Number of responses to create (default: 100000).",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=DEFAULT_BATCH,
            help=f"Insert batch size (default: {DEFAULT_BATCH}).",
        )
        parser.add_argument(
            "--survey-id",
            type=int,
            default=None,
            help="Target a single survey id; default distributes across live surveys.",
        )
        parser.add_argument(
            "--with-answers",
            action="store_true",
            help="Also bulk-insert one answer per response (first question, when present).",
        )
        parser.add_argument(
            "--flush-perf",
            action="store_true",
            help=f"Delete responses whose phone starts with {PERF_PHONE_PREFIX!r} and exit.",
        )
        parser.add_argument(
            "--days-back",
            type=int,
            default=365,
            help="Spread submitted_at over this many days (default: 365).",
        )
        parser.add_argument(
            "--use-existing-users",
            action="store_true",
            help="Assign each seeded response to a random existing user (user/phone/county).",
        )

    def handle(self, *args, **options):
        if options["flush_perf"]:
            deleted, breakdown = Response.objects.filter(
                phone_number__startswith=PERF_PHONE_PREFIX
            ).delete()
            self.stdout.write(self.style.WARNING(f"Removed {deleted} perf objects ({breakdown})."))
            invalidate_cache("survey")
            return

        count = max(0, options["count"])
        batch_size = max(500, options["batch_size"])
        if count == 0:
            self.stdout.write("Nothing to do (--count 0).")
            return

        survey_id = options["survey_id"]
        if survey_id:
            surveys = list(
                Survey.objects.filter(pk=survey_id).annotate(response_count=Count("responses"))
            )
            if not surveys:
                self.stderr.write(self.style.ERROR(f"Survey id {survey_id} not found."))
                return
        else:
            surveys = list(
                Survey.objects.filter(status=Survey.Status.LIVE)
                .annotate(response_count=Count("responses"))
                .order_by("id")
            )
            if not surveys:
                surveys = list(
                    Survey.objects.exclude(status=Survey.Status.DRAFT)
                    .annotate(response_count=Count("responses"))
                    .order_by("-id")[:5]
                )
        if not surveys:
            self.stderr.write(self.style.ERROR("No surveys found. Run: python manage.py seed_surveys"))
            return

        survey_weights = [max(1, s.response_count or 1) for s in surveys]
        rng = random.Random(100_000)
        use_existing_users = bool(options["use_existing_users"])

        question_by_survey: dict[int, Question | None] = {}
        if options["with_answers"]:
            for s in surveys:
                question_by_survey[s.pk] = (
                    Question.objects.filter(section__survey_id=s.pk)
                    .exclude(qtype__in=[Question.QType.SINGLE, Question.QType.MULTI])
                    .order_by("section__order", "order", "id")
                    .first()
                )

        existing_perf = Response.objects.filter(phone_number__startswith=PERF_PHONE_PREFIX).count()
        if existing_perf:
            self.stdout.write(self.style.WARNING(
                f"{existing_perf:,} perf responses already exist (phone prefix {PERF_PHONE_PREFIX}). "
                "Use --flush-perf to remove them first."
            ))

        user_pool: list[UserSeedRow] = []
        if use_existing_users:
            user_pool = [
                UserSeedRow(pk=u[0], phone=(u[1] or "").strip(), county_id=u[2])
                for u in User.objects.filter(is_active=True).values_list("pk", "phone", "county_id")
            ]
            if not user_pool:
                self.stderr.write(
                    self.style.ERROR("No active users found for --use-existing-users mode.")
                )
                return

        self.stdout.write(
            f"Seeding {count:,} responses across {len(surveys)} survey(s) "
            f"(batch={batch_size:,}, users={'existing' if use_existing_users else 'synthetic'}, "
            f"answers={'yes' if options['with_answers'] else 'no'})…"
        )

        now = timezone.now()
        days_back = max(1, options["days_back"])
        created_total = 0
        answer_total = 0
        t0 = time.perf_counter()
        seq = existing_perf

        for batch_start in range(0, count, batch_size):
            batch_n = min(batch_size, count - batch_start)
            responses: list[Response] = []

            for offset in range(batch_n):
                seq += 1
                survey = rng.choices(surveys, weights=survey_weights, k=1)[0]
                day_offset = rng.randint(0, days_back - 1)
                submitted = now - timedelta(
                    days=day_offset,
                    hours=rng.randint(0, 23),
                    minutes=rng.randint(0, 59),
                    seconds=rng.randint(0, 59),
                )

                selected_user = None
                phone_number = f"{PERF_PHONE_PREFIX}{seq:09d}"
                county_id = None
                if use_existing_users:
                    selected_user = rng.choice(user_pool)
                    county_id = selected_user.county_id
                    phone_number = selected_user.phone or phone_number

                responses.append(
                    Response(
                        survey=survey,
                        user_id=selected_user.pk if selected_user else None,
                        county_id=county_id,
                        phone_number=phone_number,
                        guri_number=f"G-{rng.randint(100, 999)}/{rng.randint(1, 99)}",
                        context_object="perf",
                        context_id=str(seq),
                        latitude=Decimal(str(round(2.04 + rng.uniform(-0.05, 0.05), 6))),
                        longitude=Decimal(str(round(45.32 + rng.uniform(-0.05, 0.05), 6))),
                        submitted_at=submitted,
                    )
                )

            with transaction.atomic():
                created = Response.objects.bulk_create(responses, batch_size=1000)
                created_total += len(created)

                if options["with_answers"]:
                    answers: list[Answer] = []
                    for resp in created:
                        q = question_by_survey.get(resp.survey_id)
                        if not q:
                            continue
                        if rng.random() < 0.12:
                            continue
                        if q.qtype in (Question.QType.RATING, Question.QType.INT, Question.QType.DEC):
                            answers.append(
                                Answer(
                                    response_id=resp.pk,
                                    question_id=q.pk,
                                    value_number=Decimal(str(rng.randint(1, 5))),
                                )
                            )
                        elif q.qtype == Question.QType.BOOL:
                            answers.append(
                                Answer(
                                    response_id=resp.pk,
                                    question_id=q.pk,
                                    value_bool=rng.choice([True, False]),
                                )
                            )
                        else:
                            answers.append(
                                Answer(
                                    response_id=resp.pk,
                                    question_id=q.pk,
                                    value_text=f"Perf load test response #{resp.pk}",
                                )
                            )
                    if answers:
                        Answer.objects.bulk_create(answers, batch_size=2000)
                        answer_total += len(answers)

            elapsed = time.perf_counter() - t0
            rate = created_total / elapsed if elapsed > 0 else 0
            self.stdout.write(
                f"  … {created_total:,} / {count:,} responses "
                f"({rate:,.0f}/s, {elapsed:.1f}s elapsed)"
            )

        invalidate_cache("survey")
        elapsed = time.perf_counter() - t0
        total_perf = Response.objects.filter(phone_number__startswith=PERF_PHONE_PREFIX).count()
        self.stdout.write(self.style.SUCCESS(
            f"\nDone: inserted {created_total:,} responses"
            f"{f' and {answer_total:,} answers' if options['with_answers'] else ''} "
            f"in {elapsed:.1f}s ({created_total / elapsed:,.0f} responses/s).\n"
            f"Total perf-tagged responses in DB: {total_perf:,}.\n"
            f"Remove with: python manage.py seed_survey_responses_bulk --flush-perf"
        ))
