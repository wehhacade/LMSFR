"""Visitors dashboard stats & analytics."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Count, OuterRef, Q, Subquery
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.visitors.models import Visit, Visitor
from apps.visitors.permissions import BOQDE_TYPE_ALIASES, is_boqde


def _scoped_qs(user):
    qs = Visitor.objects.filter(is_hidden=False)
    if is_boqde(user) and not (
        getattr(user, "is_superuser", False)
        or getattr(user, "is_staff", False)
        or getattr(user, "is_admin", False)
    ):
        boqde_q = Q()
        for alias in BOQDE_TYPE_ALIASES:
            boqde_q |= Q(created_by__user_type__name__iexact=alias)
        qs = qs.filter(boqde_q)
    return qs


def _delta(current: int, previous: int) -> dict:
    if previous <= 0:
        return {"pct": 100 if current else 0, "up": current >= previous}
    pct = round(abs(current - previous) / previous * 100)
    return {"pct": pct, "up": current >= previous}


def visitors_stats(user) -> dict:
    qs = _scoped_qs(user)
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    week_start = today - timedelta(days=6)

    total = qs.count()
    today_count = qs.filter(visited_at__date=today).count()
    yesterday_count = qs.filter(visited_at__date=yesterday).count()
    week_count = qs.filter(visited_at__date__gte=week_start).count()
    verified = qs.filter(verified=True).count()
    with_photo = qs.exclude(image="").exclude(image__isnull=True).count()
    with_nira = qs.exclude(nira="").count()

    return {
        "total": total,
        "today": today_count,
        "this_week": week_count,
        "verified": verified,
        "with_photo": with_photo,
        "with_nira": with_nira,
        "deltas": {
            "today": _delta(today_count, yesterday_count),
        },
    }


def visitors_analytics(user, *, range_str: str = "7d", end_date=None) -> dict:
    qs = _scoped_qs(user)
    today = end_date or timezone.localdate()
    days = 7
    if range_str.endswith("d") and range_str[:-1].isdigit():
        days = max(1, min(90, int(range_str[:-1])))
    week_start = today - timedelta(days=days - 1)

    daily_rows = (
        qs.filter(visited_at__date__gte=week_start)
        .annotate(day=TruncDate("visited_at"))
        .values("day")
        .annotate(count=Count("id"))
    )
    counts_by_day = {row["day"]: row["count"] for row in daily_rows}
    weekly_trend = []
    for offset in range(days):
        day = week_start + timedelta(days=offset)
        weekly_trend.append(
            {
                "date": day.isoformat(),
                "label": day.strftime("%a"),
                "count": counts_by_day.get(day, 0),
            }
        )

    total = qs.count() or 0
    verified = qs.filter(verified=True).count()
    pending = max(0, total - verified)
    with_photo = qs.exclude(image="").exclude(image__isnull=True).count()
    with_phone = qs.exclude(phone="").count()
    with_nira = qs.exclude(nira="").count()

    def pct(n: int) -> int:
        return round((n / total) * 100) if total else 0

    status_breakdown = [
        {"label": "Verified", "count": verified, "pct": pct(verified), "color": "#059669"},
        {"label": "Pending", "count": pending, "pct": pct(pending), "color": "#C69049"},
    ]

    breakdown = [
        {"key": "verified", "label": "Verified", "pct": pct(verified)},
        {"key": "photo", "label": "With photo", "pct": pct(with_photo)},
        {"key": "phone", "label": "With phone", "pct": pct(with_phone)},
        {"key": "nira", "label": "With NIRA", "pct": pct(with_nira)},
    ]

    top_registrars = []
    for row in (
        qs.filter(created_by__isnull=False)
        .values(
            "created_by_id",
            "created_by__first_name",
            "created_by__last_name",
            "created_by__username",
            "created_by__email",
        )
        .annotate(total=Count("id"))
        .order_by("-total")[:8]
    ):
        first = (row.get("created_by__first_name") or "").strip()
        last = (row.get("created_by__last_name") or "").strip()
        full = f"{first} {last}".strip()
        top_registrars.append(
            {
                "id": row["created_by_id"],
                "name": full
                or row.get("created_by__username")
                or row.get("created_by__email")
                or "—",
                "count": row["total"],
            }
        )

    top_visitors = [
        {
            "id": row["id"],
            "name": row["full_name"] or "—",
            "count": row["total"],
        }
        for row in (
            qs.annotate(total=Count("visits"))
            .filter(total__gt=0)
            .values("id", "full_name", "total")
            .order_by("-total", "-visited_at", "-id")[:8]
        )
    ]

    top_destinations = [
        {"name": row["visiting"] or "—", "count": row["total"]}
        for row in (
            Visit.objects.filter(visitor_id__in=qs.values("id"))
            .exclude(visiting="")
            .exclude(visiting="—")
            .values("visiting")
            .annotate(total=Count("id"))
            .order_by("-total", "visiting")[:8]
        )
    ]

    latest_visit = Visit.objects.filter(visitor_id=OuterRef("pk")).order_by("-visited_at", "-id")
    recent = []
    for v in (
        qs.select_related("created_by")
        .annotate(
            latest_registrar_first=Subquery(latest_visit.values("created_by__first_name")[:1]),
            latest_registrar_last=Subquery(latest_visit.values("created_by__last_name")[:1]),
            latest_registrar_username=Subquery(latest_visit.values("created_by__username")[:1]),
            latest_registrar_email=Subquery(latest_visit.values("created_by__email")[:1]),
        )
        .order_by("-visited_at", "-id")[:12]
    ):
        latest_full_name = " ".join(
            part for part in (v.latest_registrar_first, v.latest_registrar_last) if part
        ).strip()
        original_creator = (
            (v.created_by.get_full_name() or v.created_by.username or v.created_by.email)
            if v.created_by_id
            else None
        )
        recent.append(
            {
                "id": v.id,
                "name": v.full_name,
                "phone": v.phone or "",
                "nira": v.nira or "",
                "verified": v.verified,
                "visited_at": v.visited_at.isoformat() if v.visited_at else None,
                "registered_by": latest_full_name
                or v.latest_registrar_username
                or v.latest_registrar_email
                or original_creator,
                "color": "#059669" if v.verified else "#C69049",
            }
        )

    return {
        "weekly_trend": weekly_trend,
        "status_breakdown": status_breakdown,
        "breakdown": breakdown,
        "top_registrars": top_registrars,
        "top_visitors": top_visitors,
        "top_destinations": top_destinations,
        "recent_activity": recent,
    }
