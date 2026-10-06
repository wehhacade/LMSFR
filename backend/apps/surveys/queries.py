"""Performance-tuned survey querysets."""

from datetime import datetime, time, timedelta

from django.db.models import Count, F, IntegerField, OuterRef, Prefetch, Q, QuerySet, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import Answer, Choice, Question, Response, Survey, SurveySection

COMPLETE_Q = Q(required_answer_count__gte=F("required_total_questions"), required_total_questions__gt=0) | Q(
    required_answer_count__gt=0, required_total_questions=0
)

# deadline filter values accepted by responses/owners list APIs
DEADLINE_FILTER_EXPIRED = "expired"
DEADLINE_FILTER_UPCOMING = "upcoming"
DEADLINE_FILTER_SOON = "soon"
DEADLINE_FILTER_NONE = "none"
DEADLINE_SOON_DAYS = 7


def apply_deadline_status_filter(qs: QuerySet, deadline_status: str = "", *, prefix: str = "") -> QuerySet:
    """
    Filter Response (prefix="") or related Answer (prefix="response__") rows by deadline.
    Values: expired | upcoming | soon (<=7 days left) | none
    """
    status = (deadline_status or "").strip().lower()
    if not status:
        return qs

    duration_field = f"{prefix}deadline_duration"
    submitted_field = f"{prefix}submitted_at"
    now = timezone.now()
    qs = qs.annotate(deadline_expires_at=F(submitted_field) + F(duration_field))

    if status == DEADLINE_FILTER_EXPIRED:
        return qs.filter(**{f"{duration_field}__isnull": False, "deadline_expires_at__lte": now})
    if status == DEADLINE_FILTER_UPCOMING:
        return qs.filter(**{f"{duration_field}__isnull": False, "deadline_expires_at__gt": now})
    if status == DEADLINE_FILTER_SOON:
        soon = now + timedelta(days=DEADLINE_SOON_DAYS)
        return qs.filter(
            **{
                f"{duration_field}__isnull": False,
                "deadline_expires_at__gt": now,
                "deadline_expires_at__lte": soon,
            }
        )
    if status == DEADLINE_FILTER_NONE:
        return qs.filter(**{f"{duration_field}__isnull": True})
    return qs


def deadline_days_remaining(deadline_at) -> int | None:
    """Calendar days until deadline (0 = today, negative = overdue)."""
    if deadline_at is None:
        return None
    local_deadline = timezone.localtime(deadline_at).date()
    return (local_deadline - timezone.localdate()).days


def _answer_count_subquery() -> Subquery:
    """All questions answered — informational display count, not completion."""
    return Subquery(
        Answer.objects.filter(response_id=OuterRef("pk"))
        .values("response_id")
        .annotate(c=Count("id"))
        .values("c")[:1],
        output_field=IntegerField(),
    )


def _total_questions_subquery() -> Subquery:
    """All questions currently on the survey — informational display count."""
    return Subquery(
        Question.objects.filter(section__survey_id=OuterRef("survey_id"))
        .values("section__survey_id")
        .annotate(c=Count("id"))
        .values("c")[:1],
        output_field=IntegerField(),
    )


def _required_answer_count_subquery() -> Subquery:
    # Scoped to required questions: completion tracks mandatory fields, not
    # every optional question ever added to the form (see _required_total_questions_subquery).
    return Subquery(
        Answer.objects.filter(response_id=OuterRef("pk"), question__required=True)
        .values("response_id")
        .annotate(c=Count("id"))
        .values("c")[:1],
        output_field=IntegerField(),
    )


def _required_total_questions_subquery() -> Subquery:
    # Required questions only. A response submitted before a new *optional*
    # question was added to the survey shouldn't retroactively become
    # "incomplete" just because the total question count grew.
    return Subquery(
        Question.objects.filter(section__survey_id=OuterRef("survey_id"), required=True)
        .values("section__survey_id")
        .annotate(c=Count("id"))
        .values("c")[:1],
        output_field=IntegerField(),
    )


def annotate_list_completion(qs: QuerySet[Response]) -> QuerySet[Response]:
    """Per-row subqueries — avoids join explosion on large response tables.

    answer_count/total_questions are informational (all questions on the
    survey); required_answer_count/required_total_questions drive COMPLETE_Q.
    """
    return qs.annotate(
        answer_count=Coalesce(_answer_count_subquery(), Value(0)),
        total_questions=Coalesce(_total_questions_subquery(), Value(0)),
        required_answer_count=Coalesce(_required_answer_count_subquery(), Value(0)),
        required_total_questions=Coalesce(_required_total_questions_subquery(), Value(0)),
    )


def apply_completion_status(qs: QuerySet[Response], completion_status: str) -> QuerySet[Response]:
    if completion_status == "partial":
        return qs.exclude(COMPLETE_Q)
    if completion_status == "complete":
        return qs.filter(COMPLETE_Q)
    return qs


def _apply_datetime_range(qs: QuerySet[Response], *, date_from: str = "", date_to: str = "") -> QuerySet[Response]:
    try:
        if date_from:
            start = timezone.make_aware(datetime.combine(datetime.fromisoformat(date_from).date(), time.min))
            qs = qs.filter(submitted_at__gte=start)
        if date_to:
            end_date = datetime.fromisoformat(date_to).date() + timedelta(days=1)
            end = timezone.make_aware(datetime.combine(end_date, time.min))
            qs = qs.filter(submitted_at__lt=end)
    except ValueError:
        return qs.none()
    return qs


def survey_options_qs() -> QuerySet[Survey]:
    return Survey.objects.only("id", "name").order_by("name")


def survey_list_qs(
    *,
    search: str = "",
    status: str = "",
) -> QuerySet[Survey]:
    qs = (
        Survey.objects.select_related("created_by")
        .annotate(
            response_count=Count("responses", distinct=True),
            section_count=Count("sections", distinct=True),
        )
        .order_by("-created_at")
    )
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))
    if status:
        qs = qs.filter(status=status)
    return qs


def survey_detail_qs() -> QuerySet[Survey]:
    choices_qs = Choice.objects.only(
        "id", "label", "value", "order", "question_id"
    ).order_by("order", "id")

    questions_qs = (
        Question.objects.only(
            "id", "text", "help_text", "qtype", "required",
            "order", "min_value", "max_value", "section_id",
        )
        .prefetch_related(Prefetch("choices", queryset=choices_qs))
        .order_by("order", "id")
    )

    sections_qs = (
        SurveySection.objects.only("id", "title", "order", "survey_id")
        .prefetch_related(Prefetch("questions", queryset=questions_qs))
        .order_by("order", "id")
    )

    return (
        Survey.objects.select_related("created_by")
        .annotate(response_count=Count("responses", distinct=True))
        .prefetch_related(Prefetch("sections", queryset=sections_qs))
    )


def response_list_filter_qs(
    *,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    county_id: str = "",
) -> QuerySet[Response]:
    """Filtered responses without completion annotations — used for fast COUNT."""
    qs = (
        Response.objects.select_related("survey", "user", "county", "sub_county")
        .only(
            "id",
            "survey_id",
            "survey__name",
            "user_id",
            "user__first_name",
            "user__last_name",
            "user__username",
            "user__phone",
            "county_id",
            "county__name",
            "sub_county_id",
            "sub_county__name",
            "guri_number",
            "phone_number",
            "submitted_at",
            "deadline_duration",
            "context_object",
            "context_id",
            "latitude",
            "longitude",
        )
        .order_by("-submitted_at")
    )
    if survey_id:
        try:
            qs = qs.filter(survey_id=int(survey_id))
        except ValueError:
            return qs.none()
    if county_id:
        try:
            qs = qs.filter(county_id=int(county_id))
        except ValueError:
            return qs.none()
    if search:
        for term in search.split():
            qs = qs.filter(
                Q(phone_number__icontains=term)
                | Q(guri_number__icontains=term)
                | Q(user__phone__icontains=term)
                | Q(user__first_name__icontains=term)
                | Q(user__last_name__icontains=term)
                | Q(user__username__icontains=term)
                | Q(survey__name__icontains=term)
            )
    return _apply_datetime_range(qs, date_from=date_from, date_to=date_to)


def response_list_qs(
    *,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    completion_status: str = "",
    county_id: str = "",
    deadline_status: str = "",
) -> QuerySet[Response]:
    from apps.surveys.services.response_completion import apply_completion_status_by_pks

    qs = response_list_filter_qs(
        survey_id=survey_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        county_id=county_id,
    )
    qs = apply_completion_status_by_pks(
        qs,
        completion_status,
        survey_id=survey_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        county_id=county_id,
    )
    qs = apply_deadline_status_filter(qs, deadline_status)
    return annotate_list_completion(qs)


def response_list_count_qs(
    *,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    completion_status: str = "",
    county_id: str = "",
    deadline_status: str = "",
) -> QuerySet[Response]:
    """Legacy queryset for count — prefer count_responses_with_completion in views."""
    qs = response_list_filter_qs(
        survey_id=survey_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        county_id=county_id,
    )
    if completion_status:
        from apps.surveys.services.response_completion import apply_completion_status_by_pks

        qs = apply_completion_status_by_pks(
            qs,
            completion_status,
            survey_id=survey_id,
            search=search,
            date_from=date_from,
            date_to=date_to,
            county_id=county_id,
        )
    return apply_deadline_status_filter(qs, deadline_status)


def annotate_response_completion(qs: QuerySet[Response]) -> QuerySet[Response]:
    return annotate_list_completion(qs)


def completion_breakdown_counts(qs: QuerySet[Response]) -> tuple[int, int]:
    """Return (complete, partial) matching ResponseListSerializer logic."""
    annotated = annotate_response_completion(qs)
    total = annotated.count()
    if total == 0:
        return 0, 0

    complete = annotated.filter(COMPLETE_Q).count()
    partial = max(0, total - complete)
    return complete, partial


def completion_breakdown_items(
    complete: int,
    partial: int,
) -> list[dict]:
    """Build API payload with counts and 1-decimal percentages that sum to 100."""
    labels = [
        ("Completed", "#10b981"),
        ("Partial", "#f59e0b"),
    ]
    counts = [complete, partial]
    total = sum(counts)
    if total == 0:
        return [
            {"label": label, "count": 0, "pct": 0.0, "color": color}
            for label, color in labels
        ]

    # Largest-remainder on hundredths (2 decimal places, sums to 100.00).
    exact_hundredths = [c / total * 10000 for c in counts]
    floored = [int(x) for x in exact_hundredths]
    remainders = [exact_hundredths[i] - floored[i] for i in range(2)]
    deficit = 10000 - sum(floored)
    order = sorted(range(2), key=lambda i: remainders[i], reverse=True)
    for i in range(deficit):
        floored[order[i % 2]] += 1

    return [
        {
            "label": label,
            "count": counts[i],
            "pct": floored[i] / 100,
            "color": color,
        }
        for i, (label, color) in enumerate(labels)
    ]
