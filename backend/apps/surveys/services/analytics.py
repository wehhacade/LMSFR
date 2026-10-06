"""Advanced survey analytics aggregations."""

from datetime import datetime, time, timedelta

from django.db.models import Count, Min, Q, QuerySet
from django.db.models.functions import ExtractHour, TruncDate
from django.utils import timezone

from apps.surveys.models import Response
from apps.surveys.queries import completion_breakdown_counts
from apps.surveys.services.response_completion import get_complete_response_pks
from apps.surveys.services.respondents import (
    respondent_key_annotation,
    respondents_grouped_qs,
)


def date_range(range_str: str) -> tuple:
    end = timezone.now().date()

    if range_str == "all":
        earliest = Response.objects.aggregate(m=Min("submitted_at"))["m"]
        start = timezone.localtime(earliest).date() if earliest else end
        days = (end - start).days + 1
    else:
        days = {"7d": 7, "30d": 30, "90d": 90}.get(range_str, 90)
        start = end - timedelta(days=days - 1)

    start_dt = timezone.make_aware(datetime.combine(start, time.min))
    end_dt_exclusive = timezone.make_aware(datetime.combine(end + timedelta(days=1), time.min))
    return start, end, start_dt, end_dt_exclusive, days


def _period_qs(
    start_dt,
    end_dt_exclusive,
    *,
    search: str = "",
) -> QuerySet[Response]:
    qs = Response.objects.filter(
        submitted_at__gte=start_dt,
        submitted_at__lt=end_dt_exclusive,
    )
    if search:
        qs = qs.filter(
            Q(survey__name__icontains=search)
            | Q(phone_number__icontains=search)
            | Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
        )
    return qs


def _pct_change(current: int, previous: int) -> float:
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round((current - previous) / previous * 100, 1)


def period_summary(*, range_str: str = "90d", search: str = "") -> dict:
    start, end, start_dt, end_dt_exclusive, days = date_range(range_str)
    qs = _period_qs(start_dt, end_dt_exclusive, search=search)
    total = qs.count()
    gps_count = qs.filter(latitude__isnull=False, longitude__isnull=False).count()
    unique = (
        qs.annotate(respondent_key=respondent_key_annotation())
        .values("respondent_key")
        .distinct()
        .count()
    )
    complete, partial = completion_breakdown_counts(qs)
    completion_pct = round(complete / total * 100, 2) if total else 0.0

    # "Previous period" is meaningless for an all-time window — there's no
    # earlier window to compare against.
    if range_str == "all":
        prev_total = 0
    else:
        prev_start = start - timedelta(days=days)
        prev_start_dt = timezone.make_aware(datetime.combine(prev_start, time.min))
        prev_total = _period_qs(prev_start_dt, start_dt, search=search).count()

    peak_day = ""
    peak_count = 0
    if total:
        day_rows = (
            qs.annotate(day=TruncDate("submitted_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("-count")[:1]
        )
        if day_rows:
            peak_day = day_rows[0]["day"].strftime("%Y-%m-%d")
            peak_count = day_rows[0]["count"]

    return {
        "range": range_str,
        "total_responses": total,
        "unique_respondents": unique,
        "avg_per_day": round(total / days, 1) if days else 0.0,
        "gps_coverage_pct": round(gps_count / total * 100, 1) if total else 0.0,
        "completed_count": complete,
        "partial_count": partial,
        "completion_pct": completion_pct,
        "previous_period_responses": prev_total,
        "change_vs_previous_pct": 0.0 if range_str == "all" else _pct_change(total, prev_total),
        "peak_day": peak_day,
        "peak_day_count": peak_count,
    }


def hourly_activity(*, range_str: str = "90d", search: str = "") -> list[dict]:
    _, _, start_dt, end_dt_exclusive, _ = date_range(range_str)
    qs = _period_qs(start_dt, end_dt_exclusive, search=search)
    rows = (
        qs.annotate(hour=ExtractHour("submitted_at"))
        .values("hour")
        .annotate(count=Count("id"))
    )
    counts = {row["hour"]: row["count"] for row in rows}
    return [{"hour": h, "label": f"{h:02d}:00", "count": counts.get(h, 0)} for h in range(24)]


def responses_by_district(*, range_str: str = "90d", search: str = "") -> list[dict]:
    """Districts ranked by response volume (highest first; empty districts omitted)."""
    from apps.accounts.models import County

    _, _, start_dt, end_dt_exclusive, _ = date_range(range_str)
    qs = _period_qs(start_dt, end_dt_exclusive, search=search)
    counts = {
        row["county_id"]: row["total"]
        for row in (
            qs.filter(county_id__isnull=False)
            .values("county_id")
            .annotate(total=Count("id"))
        )
        if row["total"] > 0
    }
    if not counts:
        return []

    names = {
        row["id"]: row["name"]
        for row in County.objects.filter(pk__in=counts).values("id", "name")
    }
    result = [
        {"name": names.get(county_id, "Unknown"), "total": total}
        for county_id, total in counts.items()
    ]
    result.sort(key=lambda row: (-row["total"], row["name"]))
    return result


def completion_trend(*, range_str: str = "90d", search: str = "") -> list[dict]:
    start, end, start_dt, end_dt_exclusive, _ = date_range(range_str)
    date_from = start.isoformat()
    date_to = end.isoformat()

    base_qs = _period_qs(start_dt, end_dt_exclusive, search=search)

    total_rows = (
        base_qs.annotate(day=TruncDate("submitted_at"))
        .values("day")
        .annotate(total=Count("id"))
    )
    by_day: dict[str, dict] = {
        row["day"].strftime("%Y-%m-%d"): {
            "complete": 0,
            "partial": 0,
            "total": row["total"],
        }
        for row in total_rows
    }

    complete_pks = get_complete_response_pks(search=search, date_from=date_from, date_to=date_to)
    if complete_pks:
        complete_rows = (
            base_qs.filter(pk__in=complete_pks)
            .annotate(day=TruncDate("submitted_at"))
            .values("day")
            .annotate(complete=Count("id"))
        )
        for row in complete_rows:
            day_str = row["day"].strftime("%Y-%m-%d")
            bucket = by_day.setdefault(day_str, {"complete": 0, "partial": 0, "total": 0})
            bucket["complete"] = row["complete"]

    days_count = (end - start).days + 1
    series = []
    for i in range(days_count):
        day = start + timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        bucket = by_day.get(day_str, {"complete": 0, "partial": 0, "total": 0})
        total = bucket["total"]
        complete = bucket["complete"]
        series.append({
            "label": day.strftime("%a")[0],
            "date": day_str,
            "complete": complete,
            "partial": max(0, total - complete),
            "total": total,
        })
    return series


def top_respondents(*, range_str: str = "90d", search: str = "", limit: int = 10) -> list[dict]:
    start, end, _, _, _ = date_range(range_str)
    rows = (
        respondents_grouped_qs(
            search=search,
            date_from=start.isoformat(),
            date_to=end.isoformat(),
        )
        .order_by("-submission_count", "-last_submitted_at")[:limit]
    )
    return [
        {
            "key": row["respondent_key"],
            "display_name": row["display_name"] or "Anonymous",
            "submission_count": row["submission_count"],
            "complete_count": int(row["complete_count"] or 0),
            "completion_rate": round(int(row["complete_count"] or 0) / row["submission_count"] * 100, 1)
            if row["submission_count"]
            else 0.0,
        }
        for row in rows
    ]
