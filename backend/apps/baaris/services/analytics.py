"""Baaris dashboard stats & analytics — scoped to Suspect(source=baaris)."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import County
from apps.mobile.models import WantedPerson
from apps.suspects.models import Suspect

SUSPECT_STATUS_COLORS = {
    Suspect.Status.ACTIVE: "#46c08a",
    Suspect.Status.WATCHING: "#e6b25c",
    Suspect.Status.DETAINED: "#e0655a",
    Suspect.Status.CLEARED: "#9a8a6f",
}


def _baaris_qs():
    return Suspect.objects.filter(source=Suspect.Source.BAARIS)


def _delta(current: int, previous: int) -> dict | None:
    if previous <= 0:
        if current <= 0:
            return None
        return {"pct": 100, "up": True}
    pct = round(((current - previous) / previous) * 100)
    return {"pct": abs(pct), "up": pct >= 0}


def baaris_stats() -> dict:
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    month_start = today.replace(day=1)
    qs = _baaris_qs()

    total = qs.count()
    today_count = qs.filter(created_at__date=today).count()
    yesterday_count = qs.filter(created_at__date=yesterday).count()
    active = qs.filter(is_released=False).exclude(status=Suspect.Status.CLEARED).count()
    this_month = qs.filter(created_at__date__gte=month_start).count()
    wanted = WantedPerson.objects.count()

    return {
        "total_citizens": total,
        "registered_today": today_count,
        "active_records": active,
        "wanted_total": wanted,
        "this_month": this_month,
        "deltas": {
            "total_citizens": None,
            "registered_today": _delta(today_count, yesterday_count),
            "active_records": None,
            "wanted_total": None,
        },
    }


def baaris_analytics(*, range_str: str = "7d") -> dict:
    days = 7 if range_str != "30d" else 30
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)
    qs = _baaris_qs()

    # Weekly / daily trend
    trend_map = {
        row["bucket"].date() if hasattr(row["bucket"], "date") else row["bucket"]: row["count"]
        for row in (
            qs.filter(created_at__date__gte=start)
            .annotate(bucket=TruncDate("created_at"))
            .values("bucket")
            .annotate(count=Count("id"))
            .order_by("bucket")
        )
        if row["bucket"]
    }
    weekly_trend = []
    for i in range(days):
        d = start + timedelta(days=i)
        weekly_trend.append(
            {
                "date": d.isoformat(),
                "label": d.strftime("%a"),
                "count": trend_map.get(d, 0),
            }
        )

    total = max(qs.count(), 1)
    with_photo = qs.exclude(photo_url="").exclude(photo_url__isnull=True).count()
    with_phone = qs.exclude(phone="").count()
    with_profile = qs.filter(baaris_profile__isnull=False).count()
    breakdown = [
        {"key": "photo_coverage", "label": "Sawir", "pct": round(with_photo * 100 / total)},
        {"key": "phone_coverage", "label": "Telefoon", "pct": round(with_phone * 100 / total)},
        {"key": "profile_coverage", "label": "Dossier", "pct": round(with_profile * 100 / total)},
    ]

    status_rows = (
        qs.values("status")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    status_total = sum(r["count"] for r in status_rows) or 1
    status_breakdown = [
        {
            "label": r["status"],
            "count": r["count"],
            "pct": round(r["count"] * 100 / status_total),
            "color": SUSPECT_STATUS_COLORS.get(r["status"], "#9a8a6f"),
        }
        for r in status_rows
    ]

    # Districts chart
    counties_chart = []
    for county in County.objects.all().only("id", "name").order_by("name"):
        citizens = qs.filter(
            Q(address_id=county.id)
            | Q(capture_county_id=county.id)
            | Q(district__iexact=county.name)
        ).count()
        if citizens:
            counties_chart.append({"name": county.name, "citizens": citizens, "wanted": 0})
    counties_chart.sort(key=lambda r: (-r["citizens"], r["name"]))

    top_registrars = [
        {
            "id": row["created_by_id"],
            "name": row["created_by__first_name"]
            and f"{row['created_by__first_name']} {row['created_by__last_name'] or ''}".strip()
            or row["created_by__username"]
            or f"User {row['created_by_id']}",
            "phone": row["created_by__phone"] or "",
            "county_name": "",
            "total": row["total"],
        }
        for row in (
            qs.exclude(created_by_id=None)
            .values(
                "created_by_id",
                "created_by__username",
                "created_by__first_name",
                "created_by__last_name",
                "created_by__phone",
            )
            .annotate(total=Count("id"))
            .order_by("-total")[:10]
        )
    ]

    recent = [
        {
            "id": s.id,
            "kind": "citizen",
            "name": s.name,
            "zone": s.district or "—",
            "unit": s.case_ref,
            "status": s.status,
            "color": SUSPECT_STATUS_COLORS.get(s.status, "#9a8a6f"),
        }
        for s in qs.only("id", "name", "district", "case_ref", "status").order_by("-created_at")[:8]
    ]

    wanted_recent = WantedPerson.objects.order_by("-date_recorded")[:5]
    for w in wanted_recent:
        recent.append(
            {
                "id": w.id,
                "kind": "wanted",
                "name": w.full_name,
                "zone": w.wanted_status or "Wanted",
                "unit": w.priority or "—",
                "status": "wanted",
                "color": "#e0655a",
            }
        )

    return {
        "weekly_trend": weekly_trend[-7:],
        "daily_trend": weekly_trend,
        "breakdown": breakdown,
        "status_breakdown": status_breakdown,
        "counties_chart": counties_chart[:20],
        "top_registrars": top_registrars,
        "recent_activity": recent[:12],
        "summary": {
            "total_citizens": qs.count(),
            "wanted_total": WantedPerson.objects.count(),
            "registered_today": qs.filter(created_at__date=today).count(),
        },
    }
