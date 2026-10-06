from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.dhacdooyinka.models import Dhacdooyinka, Dhibanayaashas, NoocaDhacdooyinkaGuud, NoocaDhaxdooyinka


def _as_int(value) -> int:
    if value is None:
        return 0
    try:
        return int(str(value).strip() or 0)
    except (TypeError, ValueError):
        return 0


def _pct(part: int, total: int) -> int:
    return round((part / total) * 100) if total else 0


def dhacdooyinka_analytics() -> dict:
    """Dashboard KPIs and charts from Dhacdooyinka / Dhibanayaashas models."""
    today = timezone.localdate()
    month_start = today.replace(day=1)
    week_start = today - timedelta(days=6)

    events = Dhacdooyinka.objects.all()
    total = events.count()
    this_month = events.filter(date_recorded__date__gte=month_start).count()
    this_week = events.filter(date_recorded__date__gte=week_start).count()

    victims_total = Dhibanayaashas.objects.count()
    victims_this_month = Dhibanayaashas.objects.filter(date_recorded__gte=month_start).count()

    deaths = 0
    injuries = 0
    for death_val, injury_val in events.values_list("dhimasho", "dhaawac"):
        deaths += _as_int(death_val)
        injuries += _as_int(injury_val)

    with_document = events.exclude(upload_document="").exclude(upload_document__isnull=True).count()
    with_gps = (
        events.exclude(Q(latitude__isnull=True) | Q(latitude="") | Q(latitude="0"))
        .exclude(Q(longitude__isnull=True) | Q(longitude="") | Q(longitude="0"))
        .count()
    )
    with_victims = events.annotate(vc=Count("dhibanayaashas")).filter(vc__gt=0).count()

    daily_rows = (
        events.filter(date_recorded__date__gte=week_start)
        .annotate(day=TruncDate("date_recorded"))
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

    by_event_type = [
        {"name": row["nooca_dhacdada__type"] or "Unknown", "total": row["total"]}
        for row in (
            events.values("nooca_dhacdada__type")
            .annotate(total=Count("id"))
            .order_by("-total")[:6]
        )
    ]

    by_region = [
        {"name": row["gobolka__name"] or "Unknown", "total": row["total"]}
        for row in (
            events.values("gobolka__name")
            .annotate(total=Count("id"))
            .order_by("-total")[:6]
        )
    ]

    by_perpetrator = [
        {"name": row["cidda_fulisay"] or "Unknown", "total": row["total"]}
        for row in (
            events.exclude(Q(cidda_fulisay__isnull=True) | Q(cidda_fulisay=""))
            .values("cidda_fulisay")
            .annotate(total=Count("id"))
            .order_by("-total")[:5]
        )
    ]

    victims_by_gender = [
        {"name": row["gender"] or "Unknown", "total": row["total"]}
        for row in (
            Dhibanayaashas.objects.values("gender")
            .annotate(total=Count("id"))
            .order_by("-total")[:5]
        )
    ]

    victims_by_status = [
        {"name": row["xalada"] or "Unknown", "total": row["total"]}
        for row in (
            Dhibanayaashas.objects.exclude(Q(xalada__isnull=True) | Q(xalada=""))
            .values("xalada")
            .annotate(total=Count("id"))
            .order_by("-total")[:5]
        )
    ]

    coverage = [
        {
            "label": "With victims",
            "count": with_victims,
            "pct": _pct(with_victims, total),
            "color": "#f0a04a",
        },
        {
            "label": "With documents",
            "count": with_document,
            "pct": _pct(with_document, total),
            "color": "#2563eb",
        },
        {
            "label": "With GPS",
            "count": with_gps,
            "pct": _pct(with_gps, total),
            "color": "#059669",
        },
    ]

    recent = []
    for row in (
        events.select_related("gobolka", "degmada", "waaxda", "nooca_dhacdada")
        .annotate(victim_count=Count("dhibanayaashas"))
        .order_by("-date_recorded")[:6]
    ):
        parts = [
            row.gobolka.name if row.gobolka else None,
            row.degmada.name if row.degmada else None,
            row.waaxda.name if row.waaxda else None,
        ]
        recent.append({
            "id": row.id,
            "tixraac_lambar": row.tixraac_lambar,
            "location_display": ", ".join(p for p in parts if p) or "—",
            "nooca_dhacdada_name": row.nooca_dhacdada.type if row.nooca_dhacdada else None,
            "cidda_fulisay": row.cidda_fulisay,
            "dhimasho": row.dhimasho,
            "dhaawac": row.dhaawac,
            "victim_count": row.victim_count,
            "date_recorded": row.date_recorded.isoformat() if row.date_recorded else None,
        })

    return {
        "total": total,
        "this_month": this_month,
        "this_week": this_week,
        "victims_total": victims_total,
        "victims_this_month": victims_this_month,
        "deaths": deaths,
        "injuries": injuries,
        "casualties": deaths + injuries,
        "with_document": with_document,
        "with_gps": with_gps,
        "with_victims": with_victims,
        "sections_total": NoocaDhacdooyinkaGuud.objects.count(),
        "types_total": NoocaDhaxdooyinka.objects.count(),
        "weekly_trend": weekly_trend,
        "by_event_type": by_event_type,
        "by_region": by_region,
        "by_perpetrator": by_perpetrator,
        "victims_by_gender": victims_by_gender,
        "victims_by_status": victims_by_status,
        "coverage": coverage,
        "recent": recent,
    }
