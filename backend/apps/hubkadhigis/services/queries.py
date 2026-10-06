from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.hubkadhigis.models import DisarmamentImage, DisarmamentRecord

# Handed over = weapon surrender completed (surrender date recorded).
HANDED_OVER_Q = Q(surrender_date__isnull=False)

HAS_MEDIA_Q = (
    Q(person_image__gt="")
    | Q(cover_image__gt="")
    | Exists(DisarmamentImage.objects.filter(record_id=OuterRef("pk")))
)


def disarmament_registry_qs(
    *,
    search: str = "",
    county: str = "",
    weapon_type: str = "",
    force_unit: str = "",
    has_images: str = "",
    status: str = "",
):
    qs = DisarmamentRecord.objects.select_related(
        "force_unit",
        "rank",
        "weapon_type",
        "county",
        "surrender_location",
        "created_by",
    )
    if search:
        qs = qs.filter(
            Q(person_name__icontains=search)
            | Q(reference_number__icontains=search)
            | Q(weapon_serial__icontains=search)
            | Q(police_station__icontains=search)
            | Q(phone_number__icontains=search)
            | Q(force_number__icontains=search)
        )
    if county:
        qs = qs.filter(county_id=county)
    if weapon_type:
        qs = qs.filter(weapon_type_id=weapon_type)
    if force_unit:
        qs = qs.filter(force_unit_id=force_unit)
    if has_images in ("1", "true", "yes"):
        qs = qs.filter(HAS_MEDIA_Q).distinct()
    if status == "handed_over":
        qs = qs.filter(HANDED_OVER_Q)
    elif status == "registered":
        qs = qs.exclude(HANDED_OVER_Q)
    return qs.order_by("-created_at")


def person_history_qs(*, phone: str = "", person_name: str = "", limit: int = 20):
    """Prior disarmament records for the same person (phone match preferred)."""
    qs = DisarmamentRecord.objects.select_related(
        "force_unit",
        "rank",
        "weapon_type",
        "county",
        "surrender_location",
    ).annotate(image_count=Count("images"))

    phone = phone.strip()
    person_name = person_name.strip()

    if phone:
        normalized = "".join(ch for ch in phone if ch.isdigit())
        if len(normalized) >= 6:
            qs = qs.filter(
                Q(phone_number__icontains=phone)
                | Q(phone_number__icontains=normalized[-9:])
            )
        else:
            qs = qs.filter(phone_number__icontains=phone)
    elif person_name:
        qs = qs.filter(person_name__icontains=person_name)
    else:
        return DisarmamentRecord.objects.none()

    return qs.order_by("-created_at")[:limit]


def disarmament_stats() -> dict:
    today = timezone.now().date()
    month_start = today.replace(day=1)
    return DisarmamentRecord.objects.aggregate(
        total=Count("id"),
        this_month=Count("id", filter=Q(created_at__date__gte=month_start)),
        with_weapon=Count("id", filter=Q(weapon_type__isnull=False)),
        with_images=Count("id", filter=HAS_MEDIA_Q, distinct=True),
    )


def disarmament_analytics() -> dict:
    """Dashboard charts: weekly trend, status mix, top weapon types & force units."""
    today = timezone.localdate()
    week_start = today - timedelta(days=6)

    daily_rows = (
        DisarmamentRecord.objects.filter(created_at__date__gte=week_start)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(count=Count("id"))
    )
    counts_by_day = {row["day"]: row["count"] for row in daily_rows}

    weekly_trend = []
    for offset in range(7):
        day = week_start + timedelta(days=offset)
        weekly_trend.append({
            "date": day.isoformat(),
            "label": day.strftime("%a"),
            "count": counts_by_day.get(day, 0),
        })

    total = DisarmamentRecord.objects.count()
    handed_over = DisarmamentRecord.objects.filter(HANDED_OVER_Q).count() if total else 0
    registered = max(0, total - handed_over)

    def pct(n: int) -> int:
        return round((n / total) * 100) if total else 0

    status_breakdown = [
        {"label": "Handed over", "count": handed_over, "pct": pct(handed_over), "color": "#059669"},
        {"label": "Registered", "count": registered, "pct": pct(registered), "color": "#C69049"},
    ]

    by_weapon_type = [
        {"name": row["weapon_type__name"] or "Unknown", "total": row["total"]}
        for row in (
            DisarmamentRecord.objects.filter(weapon_type__isnull=False)
            .values("weapon_type__name")
            .annotate(total=Count("id"))
            .order_by("-total")[:6]
        )
    ]

    by_force_unit = [
        {"name": row["force_unit__name"] or "Unknown", "total": row["total"]}
        for row in (
            DisarmamentRecord.objects.filter(force_unit__isnull=False)
            .values("force_unit__name")
            .annotate(total=Count("id"))
            .order_by("-total")[:6]
        )
    ]

    return {
        "weekly_trend": weekly_trend,
        "status_breakdown": status_breakdown,
        "by_weapon_type": by_weapon_type,
        "by_force_unit": by_force_unit,
    }
