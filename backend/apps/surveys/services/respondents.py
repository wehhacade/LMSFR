"""Aggregate survey responses by respondent identity."""

from collections import deque
from datetime import datetime, time, timedelta

from django.db.models import (
    Case,
    CharField,
    Count,
    F,
    IntegerField,
    Max,
    Min,
    OuterRef,
    Q,
    QuerySet,
    Subquery,
    Sum,
    Value,
    Window,
    When,
)
from django.db.models.functions import Cast, Coalesce, Concat, RowNumber, Trim
from django.utils import timezone

from apps.surveys.models import Answer, Question, Response

ACTIVE_DAYS = 7
MAX_MAP_TRAIL_POINTS = 120


def _apply_datetime_range(qs: QuerySet[Response], date_from: str = "", date_to: str = "") -> QuerySet[Response]:
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


def resolve_respondent_display_name(
    *,
    display_name: str = "",
    phone_number: str = "",
    guri_number: str = "",
    username: str = "",
    email: str = "",
) -> str:
    name = (display_name or "").strip()
    if name:
        return name
    for candidate in (phone_number, guri_number, username, email):
        value = (candidate or "").strip()
        if value:
            return value
    return "Anonymous"


def respondent_key_annotation() -> Case:
    return Case(
        When(user_id__isnull=False, then=Concat(Value("user:"), Cast("user_id", CharField()))),
        When(~Q(phone_number=""), then=Concat(Value("phone:"), "phone_number")),
        When(
            ~Q(context_object="") & ~Q(context_id=""),
            then=Concat(Value("ctx:"), "context_object", Value(":"), "context_id"),
        ),
        default=Concat(Value("resp:"), Cast("id", CharField())),
        output_field=CharField(),
    )


def display_name_annotation() -> Case:
    return Case(
        When(
            user_id__isnull=False,
            then=Trim(Concat(
                Coalesce("user__first_name", Value("")),
                Value(" "),
                Coalesce("user__last_name", Value("")),
            )),
        ),
        When(~Q(phone_number=""), then="phone_number"),
        When(~Q(guri_number=""), then="guri_number"),
        default=Value("Anonymous"),
        output_field=CharField(),
    )


def _answer_count_subquery() -> Subquery:
    # Scoped to required questions — see apps.surveys.queries for the same pattern.
    return Subquery(
        Answer.objects.filter(response_id=OuterRef("pk"), question__required=True)
        .values("response_id")
        .annotate(c=Count("id"))
        .values("c")[:1],
        output_field=IntegerField(),
    )


def _total_questions_subquery() -> Subquery:
    return Subquery(
        Question.objects.filter(section__survey_id=OuterRef("survey_id"), required=True)
        .values("section__survey_id")
        .annotate(c=Count("id"))
        .values("c")[:1],
        output_field=IntegerField(),
    )


def completion_flag_annotation() -> Case:
    return Case(
        When(
            Q(answer_count__gte=F("total_questions"), total_questions__gt=0)
            | Q(answer_count__gt=0, total_questions=0),
            then=Value(1),
        ),
        default=Value(0),
        output_field=IntegerField(),
    )


def response_qs_with_respondent_meta(
    *,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
) -> QuerySet[Response]:
    qs = (
        Response.objects.select_related("user", "county", "sub_county", "survey")
        .annotate(
            answer_count=Coalesce(_answer_count_subquery(), Value(0)),
            total_questions=Coalesce(_total_questions_subquery(), Value(0)),
        )
        .annotate(
            is_complete=completion_flag_annotation(),
            respondent_key=respondent_key_annotation(),
            display_name=display_name_annotation(),
        )
    )
    if survey_id:
        try:
            qs = qs.filter(survey_id=int(survey_id))
        except ValueError:
            return qs.none()
    if search:
        qs = qs.filter(
            Q(phone_number__icontains=search)
            | Q(guri_number__icontains=search)
            | Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
            | Q(user__username__icontains=search)
            | Q(context_id__icontains=search)
            | Q(survey__name__icontains=search)
        )
    qs = _apply_datetime_range(qs, date_from=date_from, date_to=date_to)
    return qs


def respondents_grouped_qs(
    *,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    activity_status: str = "",
) -> QuerySet:
    qs = response_qs_with_respondent_meta(
        survey_id=survey_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    grouped = qs.values("respondent_key").annotate(
        display_name=Max("display_name"),
        user_id=Max("user_id"),
        username=Max("user__username"),
        email=Max("user__email"),
        phone_number=Max("phone_number"),
        guri_number=Max("guri_number"),
        context_object=Max("context_object"),
        context_id=Max("context_id"),
        county_name=Max("county__name"),
        sub_county_name=Max("sub_county__name"),
        submission_count=Count("id"),
        survey_count=Count("survey_id", distinct=True),
        district_count=Count("sub_county_id", distinct=True, filter=Q(sub_county_id__isnull=False)),
        complete_count=Sum("is_complete"),
        last_submitted_at=Max("submitted_at"),
        first_submitted_at=Min("submitted_at"),
    ).annotate(
        partial_count=Count("id") - Sum("is_complete"),
    )

    cutoff = timezone.now() - timedelta(days=ACTIVE_DAYS)
    if activity_status == "active":
        grouped = grouped.filter(last_submitted_at__gte=cutoff)
    elif activity_status == "idle":
        grouped = grouped.filter(last_submitted_at__lt=cutoff)

    return grouped.order_by("-last_submitted_at")


def parse_respondent_key(key: str) -> dict:
    if key.startswith("user:"):
        return {"user_id": int(key[5:])}
    if key.startswith("phone:"):
        return {"phone_number": key[6:]}
    if key.startswith("ctx:"):
        rest = key[4:]
        obj, _, cid = rest.partition(":")
        return {"context_object": obj, "context_id": cid}
    if key.startswith("resp:"):
        return {"response_id": int(key[5:])}
    raise ValueError(f"Invalid respondent key: {key}")


def filter_responses_by_key(qs: QuerySet[Response], key: str) -> QuerySet[Response]:
    parsed = parse_respondent_key(key)
    if "user_id" in parsed:
        return qs.filter(user_id=parsed["user_id"])
    if "phone_number" in parsed:
        return qs.filter(user_id__isnull=True, phone_number=parsed["phone_number"])
    if "context_object" in parsed:
        return qs.filter(
            user_id__isnull=True,
            phone_number="",
            context_object=parsed["context_object"],
            context_id=parsed["context_id"],
        )
    return qs.filter(pk=parsed["response_id"])


def respondent_detail(respondent_key: str) -> dict | None:
    """Fast single-respondent profile — filter by key first, never group the full table."""
    from apps.surveys.services.response_completion import get_complete_response_pks

    base = filter_responses_by_key(
        Response.objects.select_related("user", "county", "sub_county"),
        respondent_key,
    )
    latest = base.order_by("-submitted_at").first()
    if latest is None:
        return None

    agg = base.aggregate(
        submission_count=Count("id"),
        survey_count=Count("survey_id", distinct=True),
        district_count=Count(
            "sub_county_id",
            distinct=True,
            filter=Q(sub_county_id__isnull=False),
        ),
        last_submitted_at=Max("submitted_at"),
        first_submitted_at=Min("submitted_at"),
    )

    complete_pks = get_complete_response_pks()
    complete_count = (
        base.filter(pk__in=complete_pks).count() if complete_pks else 0
    )
    submission_count = agg["submission_count"] or 0

    user = latest.user if latest.user_id else None
    display_name = ""
    username = ""
    email = ""
    if user is not None:
        username = user.username or ""
        email = user.email or ""
        display_name = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()

    return {
        "respondent_key": respondent_key,
        "display_name": display_name,
        "user_id": latest.user_id,
        "username": username,
        "email": email,
        "phone_number": latest.phone_number or "",
        "guri_number": latest.guri_number or "",
        "context_object": latest.context_object or "",
        "context_id": latest.context_id or "",
        "county_name": latest.county.name if latest.county_id else None,
        "sub_county_name": latest.sub_county.name if latest.sub_county_id else None,
        "submission_count": submission_count,
        "survey_count": agg["survey_count"] or 0,
        "district_count": agg["district_count"] or 0,
        "complete_count": complete_count,
        "partial_count": max(0, submission_count - complete_count),
        "last_submitted_at": agg["last_submitted_at"],
        "first_submitted_at": agg["first_submitted_at"],
    }


def respondents_summary(
    *,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
) -> dict:
    grouped = respondents_grouped_qs(
        survey_id=survey_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    cutoff = timezone.now() - timedelta(days=ACTIVE_DAYS)

    totals = grouped.aggregate(
        total_respondents=Count("respondent_key"),
        active_respondents=Count("respondent_key", filter=Q(last_submitted_at__gte=cutoff)),
        total_submissions=Sum("submission_count"),
        total_complete=Sum("complete_count"),
    )

    # Count raw responses in last ACTIVE_DAYS days without the heavy respondent annotations.
    week_qs = Response.objects.filter(submitted_at__gte=cutoff)
    if survey_id:
        try:
            week_qs = week_qs.filter(survey_id=int(survey_id))
        except ValueError:
            week_qs = week_qs.none()
    if search:
        week_qs = week_qs.filter(
            Q(phone_number__icontains=search)
            | Q(guri_number__icontains=search)
            | Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
            | Q(user__username__icontains=search)
            | Q(context_id__icontains=search)
        )
    week_qs = _apply_datetime_range(week_qs, date_from=date_from, date_to=date_to)

    total_subs = totals["total_submissions"] or 0
    total_complete = totals["total_complete"] or 0
    avg_completion_rate = round((total_complete / total_subs) * 100) if total_subs else 0

    return {
        "total_respondents": totals["total_respondents"] or 0,
        "active_respondents": totals["active_respondents"] or 0,
        "submissions_this_week": week_qs.count(),
        "avg_completion_rate": avg_completion_rate,
    }


def respondents_map_data(
    *,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    activity_status: str = "",
    include_locations: bool = False,
) -> list[dict]:
    """Per-respondent map pins from GPS-tagged submissions."""
    grouped_rows = list(
        respondents_grouped_qs(
            survey_id=survey_id,
            search=search,
            date_from=date_from,
            date_to=date_to,
            activity_status=activity_status,
        ).values(
            "respondent_key",
            "display_name",
            "phone_number",
            "guri_number",
            "username",
            "email",
            "submission_count",
            "district_count",
        )
    )
    if not grouped_rows:
        return []

    keys = [row["respondent_key"] for row in grouped_rows]
    qs = response_qs_with_respondent_meta(
        survey_id=survey_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    ).filter(
        latitude__isnull=False,
        longitude__isnull=False,
        respondent_key__in=keys,
    )
    row_limit = MAX_MAP_TRAIL_POINTS if include_locations else 1
    qs = qs.annotate(
        row_num=Window(
            expression=RowNumber(),
            partition_by=[F("respondent_key")],
            order_by=F("submitted_at").desc(),
        )
    ).filter(row_num__lte=row_limit)

    rows = qs.values(
        "respondent_key",
        "latitude",
        "longitude",
        "sub_county__name",
        "id",
        "submitted_at",
    ).order_by("respondent_key", "-submitted_at")

    buckets: dict[str, dict] = {}
    for row in grouped_rows:
        key = row["respondent_key"]
        buckets[key] = {
            "key": key,
            "display_name": resolve_respondent_display_name(
                display_name=row["display_name"] or "",
                phone_number=row["phone_number"] or "",
                guri_number=row["guri_number"] or "",
                username=row["username"] or "",
                email=row["email"] or "",
            ),
            "phone_number": row["phone_number"] or "",
            "submission_count": row["submission_count"] or 0,
            "district_count": row["district_count"] or 0,
            "districts": [],
            "latitude": None,
            "longitude": None,
            "locations": deque(maxlen=MAX_MAP_TRAIL_POINTS if include_locations else 1),
            "_district_names": set(),
        }

    for row in rows:
        key = row["respondent_key"]
        bucket = buckets.get(key)
        if not bucket:
            continue
        lat = float(row["latitude"])
        lng = float(row["longitude"])

        if bucket["latitude"] is None:
            bucket["latitude"] = lat
            bucket["longitude"] = lng

        district_name = row["sub_county__name"] or ""
        if district_name and district_name not in bucket["_district_names"]:
            bucket["_district_names"].add(district_name)
            bucket["districts"].append(district_name)

        if include_locations:
            bucket["locations"].append({
                "response_id": row["id"],
                "latitude": lat,
                "longitude": lng,
                "sub_county_name": district_name,
                "submitted_at": row["submitted_at"],
            })

    result: list[dict] = []
    for bucket in buckets.values():
        locs = list(bucket["locations"])
        if include_locations and not locs:
            continue
        del bucket["_district_names"]
        bucket["locations"] = locs if include_locations else []
        result.append(bucket)

    result.sort(key=lambda r: (-r["submission_count"], r["display_name"]))
    return result


def respondent_map_trail_data(
    *,
    respondent_key: str,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    activity_status: str = "",
) -> dict:
    # Filter by respondent first — avoid annotating the full responses table.
    qs = filter_responses_by_key(
        Response.objects.filter(latitude__isnull=False, longitude__isnull=False),
        respondent_key,
    ).select_related("sub_county")
    if survey_id:
        try:
            qs = qs.filter(survey_id=int(survey_id))
        except ValueError:
            return {"key": respondent_key, "locations": []}
    qs = _apply_datetime_range(qs, date_from=date_from, date_to=date_to)
    cutoff = timezone.now() - timedelta(days=ACTIVE_DAYS)
    if activity_status == "active":
        qs = qs.filter(submitted_at__gte=cutoff)
    elif activity_status == "idle":
        qs = qs.filter(submitted_at__lt=cutoff)

    rows = qs.order_by("-submitted_at").values(
        "id", "latitude", "longitude", "sub_county__name", "submitted_at",
    )[:MAX_MAP_TRAIL_POINTS]
    locations = [
        {
            "response_id": row["id"],
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "sub_county_name": row["sub_county__name"] or "",
            "submitted_at": row["submitted_at"],
        }
        for row in rows
    ]
    return {"key": respondent_key, "locations": locations}
