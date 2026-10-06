import re
from datetime import date as date_cls
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Q
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone

from apps.accounts.models import Agent, County
from apps.audit.models import AuditTrail
from apps.forces.models import MOGADISHU_DISTRICTS, Force
from apps.mobile.helpers import (
    APP_LOGIN_ACTION,
    format_mobile_device_label,
    lookup_legacy_device_meta,
)
from apps.mobile.models import MobileTask, UserLocation
from apps.suspects.models import (
    Damiinada,
    Suspect,
    SuspectArrest,
    SuspectComment,
    SuspectResponse,
)
from apps.suspects.photo_utils import resolve_photo_url

User = get_user_model()

FORCE_STATUS_COLORS = {
    Force.Status.ON_DUTY: "#46c08a",
    Force.Status.ON_LEAVE: "#e6b25c",
    Force.Status.MEDICAL: "#e0655a",
    Force.Status.SUSPENDED: "#9a8a6f",
}

SUSPECT_STATUS_COLORS = {
    Suspect.Status.ACTIVE: "#46c08a",
    Suspect.Status.WATCHING: "#e6b25c",
    Suspect.Status.DETAINED: "#e0655a",
    Suspect.Status.CLEARED: "#9a8a6f",
}

AGENT_PRESENT_COLORS = {
    "Joogey": "#46c08a",
    "Maqan": "#e6b25c",
    "Xanuunsan": "#e0655a",
    "Staff": "#9a8a6f",
    "Fakad": "#e6b25c",
    "Fasax": "#e6b25c",
}

AGENT_PRESENT_STATUS = {
    "Joogey": "on_duty",
    "Maqan": "on_leave",
    "Xanuunsan": "medical",
    "Staff": "suspended",
    "Fakad": "on_leave",
    "Fasax": "on_leave",
}


def _is_privileged(user) -> bool:
    return bool(
        user.is_superuser or user.is_staff or getattr(user, "is_admin", False)
    )


def can_view_suspects(user) -> bool:
    return _is_privileged(user) or user.has_perm("suspects.view_suspect")


def can_view_forces(user) -> bool:
    return _is_privileged(user) or user.has_perm("forces.view_force")


def can_view_agents(user) -> bool:
    return (
        _is_privileged(user)
        or user.has_perm("accounts.view_agent")
        or getattr(user, "is_agent", False)
    )


def can_view_reports(user) -> bool:
    return _is_privileged(user) or user.has_perm("suspects.view_daily_report")


def _agents_on_duty_qs():
    return Agent.objects.filter(
        present="Joogey",
        status="Active",
        user__is_active=True,
        user__suspend=False,
    )


def _personnel_stats(user) -> tuple[int, int]:
    """Active patrols = all agents; guards on duty = present/on-duty agents."""
    active_patrols = 0
    guards_on_duty = 0

    if can_view_agents(user):
        active_patrols = Agent.objects.count()
        guards_on_duty = _agents_on_duty_qs().count()

    if guards_on_duty == 0 and can_view_forces(user) and Force.objects.exists():
        guards_on_duty = Force.objects.filter(status=Force.Status.ON_DUTY).count()

    return active_patrols, guards_on_duty


def _counties_chart(user) -> list[dict]:
    """Official degmooyin with suspect / agent / user counts (GIS dashboard chart source)."""
    if not can_view_suspects(user) and not can_view_agents(user):
        return []

    rows: list[dict] = []
    for county in County.objects.all().only("id", "name").order_by("name"):
        suspects = 0
        if can_view_suspects(user):
            suspects = Suspect.objects.filter(
                Q(capture_county_id=county.id) | Q(district__iexact=county.name),
                is_released=False,
            ).count()
        agents = Agent.objects.filter(county_id=county.id).count() if can_view_agents(user) else 0
        field_users = User.objects.filter(county_id=county.id, is_agent=True).count()
        rows.append({
            "name": county.name,
            "suspects": suspects,
            "agents": agents,
            "users": field_users,
        })
    return sorted(rows, key=lambda row: (-row["suspects"], row["name"]))


def _top_registrars(user, *, limit: int = 10) -> list[dict]:
    if not can_view_suspects(user):
        return []
    rows = []
    for row in (
        Suspect.objects.exclude(created_by__isnull=True)
        .values(
            "created_by_id",
            "created_by__first_name",
            "created_by__last_name",
            "created_by__username",
            "created_by__phone",
            "created_by__email",
            "created_by__county__name",
        )
        .annotate(total=Count("id"))
        .order_by("-total")[:limit]
    ):
        first = (row["created_by__first_name"] or "").strip()
        last = (row["created_by__last_name"] or "").strip()
        name = f"{first} {last}".strip() or row["created_by__username"] or row["created_by__email"] or "—"
        rows.append({
            "id": row["created_by_id"],
            "name": name,
            "phone": row["created_by__phone"] or "",
            "county_name": row["created_by__county__name"] or "",
            "total": row["total"],
        })
    return rows


def _user_activity_summary(user) -> dict:
    if not can_view_agents(user) and not can_view_suspects(user):
        return {
            "total_users": 0,
            "active_users": 0,
            "logged_today": 0,
            "never_login": 0,
            "total_suspects": 0,
        }

    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    agent_qs = User.objects.filter(is_agent=True)
    summary = agent_qs.aggregate(
        total_users=Count("id"),
        active_users=Count("id", filter=Q(is_active=True, suspend=False)),
        logged_today=Count("id", filter=Q(last_login__gte=today_start)),
        never_login=Count("id", filter=Q(last_login__isnull=True)),
    )
    return {
        "total_users": summary["total_users"] or 0,
        "active_users": summary["active_users"] or 0,
        "logged_today": summary["logged_today"] or 0,
        "never_login": summary["never_login"] or 0,
        "total_suspects": Suspect.objects.count() if can_view_suspects(user) else 0,
    }


def _pct_change(current: int, previous: int) -> dict | None:
    if previous <= 0:
        if current <= 0:
            return None
        return {"pct": 100, "up": True}
    delta = round(((current - previous) / previous) * 100)
    if delta == 0:
        return None
    return {"pct": abs(delta), "up": delta > 0}


def _incidents_on(date) -> int:
    suspects = Suspect.objects.filter(created_at__date=date).count()
    arrests = SuspectArrest.objects.filter(arrested_at__date=date).count()
    return suspects + arrests


def _weekly_series(user, *, days: int = 7) -> list[dict]:
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)

    counts_by_day: dict = {}
    if can_view_suspects(user):
        for row in (
            Suspect.objects.filter(created_at__date__gte=start)
            .annotate(bucket_day=TruncDate("created_at"))
            .values("bucket_day")
            .annotate(count=Count("id"))
        ):
            counts_by_day[row["bucket_day"]] = counts_by_day.get(row["bucket_day"], 0) + row["count"]
        for row in (
            SuspectArrest.objects.filter(arrested_at__date__gte=start)
            .annotate(bucket_day=TruncDate("arrested_at"))
            .values("bucket_day")
            .annotate(count=Count("id"))
        ):
            counts_by_day[row["bucket_day"]] = counts_by_day.get(row["bucket_day"], 0) + row["count"]
    if can_view_reports(user):
        for row in (
            MobileTask.objects.filter(created_at__date__gte=start)
            .annotate(bucket_day=TruncDate("created_at"))
            .values("bucket_day")
            .annotate(count=Count("id"))
        ):
            counts_by_day[row["bucket_day"]] = counts_by_day.get(row["bucket_day"], 0) + row["count"]

    series = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        series.append({
            "date": day.isoformat(),
            "label": day.strftime("%a")[0],
            "count": counts_by_day.get(day, 0),
        })
    return series


def amniga_stats(user) -> dict:
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)

    active_patrols, guards_on_duty = _personnel_stats(user)

    incidents_today = _incidents_on(today) if can_view_suspects(user) else 0
    incidents_yesterday = _incidents_on(yesterday) if can_view_suspects(user) else 0

    daily_reports = 0
    daily_reports_yesterday = 0
    if can_view_reports(user):
        daily_reports = MobileTask.objects.filter(created_at__date=today).count()
        daily_reports_yesterday = MobileTask.objects.filter(created_at__date=yesterday).count()

    return {
        "active_patrols": active_patrols,
        "incidents_today": incidents_today,
        "guards_on_duty": guards_on_duty,
        "daily_reports": daily_reports,
        "deltas": {
            "active_patrols": None,
            "incidents_today": _pct_change(incidents_today, incidents_yesterday),
            "guards_on_duty": None,
            "daily_reports": _pct_change(daily_reports, daily_reports_yesterday),
        },
    }


def amniga_breakdown(user) -> list[dict]:
    items: list[dict] = []

    if can_view_forces(user) and Force.objects.exists():
        covered = (
            Force.objects.filter(status=Force.Status.ON_DUTY)
            .values_list("district", flat=True)
            .distinct()
            .count()
        )
        total_districts = len(MOGADISHU_DISTRICTS)
        patrol_pct = round((covered / total_districts) * 100) if total_districts else 0
        items.append({"key": "patrol_coverage", "label": "Patrol coverage", "pct": patrol_pct})
    elif can_view_agents(user):
        total_districts = County.objects.count() or len(MOGADISHU_DISTRICTS)
        covered = (
            _agents_on_duty_qs()
            .exclude(county__isnull=True)
            .values("county_id")
            .distinct()
            .count()
        )
        patrol_pct = round((covered / total_districts) * 100) if total_districts else 0
        items.append({"key": "patrol_coverage", "label": "Patrol coverage", "pct": patrol_pct})

    if can_view_reports(user):
        total_reports = MobileTask.objects.count()
        seen = MobileTask.objects.filter(is_seen=True).count()
        sla_pct = round((seen / total_reports) * 100) if total_reports else 0
        items.append({"key": "report_response", "label": "Report response", "pct": sla_pct})

    if can_view_suspects(user):
        total = Suspect.objects.count()
        closed = Suspect.objects.filter(
            Q(status=Suspect.Status.CLEARED) | Q(is_released=True)
        ).count()
        closure_pct = round((closed / total) * 100) if total else 0
        items.append({"key": "case_closure", "label": "Case closure", "pct": closure_pct})

    return items


def _login_os_and_client(trail, user=None) -> tuple[str, str]:
    """Resolve device label (Android · Samsung A12) and mobile/web channel."""
    ua = f"{trail.network or ''} {trail.browser or ''}".lower()
    path = (trail.path or "").lower()
    action = trail.action or ""
    details = trail.details if isinstance(getattr(trail, "details", None), dict) else {}

    is_app = action.startswith(APP_LOGIN_ACTION)
    is_web_auth = "/auth/login/" in path or action.startswith("User logged in")
    is_mobile_ua = any(t in ua for t in ("okhttp", "dalvik", "android", "iphone", "ipod", "ipad", "cfnetwork", "mobile-app"))
    is_mobile = is_app or (is_mobile_ua and not is_web_auth)

    if not is_mobile:
        os_raw = (trail.operating_system or "").strip()
        if os_raw and os_raw.lower() not in {"unknown", "null", "none", "-"}:
            label = os_raw
        elif "windows" in ua:
            label = "Windows"
        elif "mac os" in ua or "macintosh" in ua:
            label = "macOS"
        elif "linux" in ua or "x11" in ua:
            label = "Linux"
        else:
            browser = (trail.browser or "").strip() or "Web"
            label = f"{browser} · Web" if browser.lower() not in {"unknown", ""} else "Web"
        # Prefer "Chrome · Windows" style for web.
        browser = (trail.browser or "").strip()
        if browser and browser.lower() not in {"unknown", "null"} and label in {"Windows", "macOS", "Linux"}:
            label = f"{browser} · {label}"
        return label, "web"

    label = format_mobile_device_label(
        operating_system=trail.operating_system,
        browser=trail.browser,
        network=trail.network,
        details=details,
        mobile_type=getattr(user, "mobile_type", None) if user else None,
    )
    weak = label in {"—", "Android", "iOS", "Android · Samsung", "iOS · iPhone"}
    if weak and user is not None:
        legacy = lookup_legacy_device_meta(user.pk)
        if legacy:
            legacy_label = format_mobile_device_label(
                operating_system=legacy.get("operating_system"),
                browser=legacy.get("browser"),
                network=legacy.get("network"),
                mobile_type=getattr(user, "mobile_type", None),
            )
            if legacy_label not in {"—", "Android", "iOS"}:
                label = legacy_label
        if label in {"—", "Android"} and getattr(user, "mobile_type", None):
            brand = (user.mobile_type or "").strip()
            if brand and brand.lower() not in {"no phone", "null"}:
                label = f"Android · {brand}" if brand.lower() != "iphone" else "iOS · iPhone"
    return label, "mobile"


def amniga_recent_activity(user, *, limit: int = 8) -> list[dict]:
    """Latest app + web login events for the Amniga dashboard feed."""
    trails = (
        AuditTrail.objects.filter(
            Q(action__startswith=APP_LOGIN_ACTION)
            | Q(event_type=AuditTrail.EventType.LOGIN, path__icontains="/auth/login/")
            | Q(event_type=AuditTrail.EventType.LOGIN, action__startswith="User logged in")
        )
        .select_related("user", "user__county", "user__agent_profile")
        .order_by("-created_at")[:limit]
    )
    rows: list[dict] = []
    for trail in trails:
        u = trail.user
        if not u:
            continue
        device_label, client = _login_os_and_client(trail, u)
        name = (u.get_full_name() or "").strip() or u.username or u.email or "—"
        county = u.county.name if getattr(u, "county_id", None) else "—"
        phone = (u.phone or "").strip() or "—"
        profile = None
        if u.profile and getattr(u.profile, "name", None):
            profile = resolve_photo_url(u.profile.name)
        elif getattr(u, "agent_profile", None) and u.agent_profile.profile:
            profile = resolve_photo_url(u.agent_profile.profile.name)

        rows.append({
            "id": trail.id,
            "kind": "app_login" if client == "mobile" else "web_login",
            "unit": phone,
            "zone": county,
            "name": name,
            "status": client,
            "color": "#46c08a" if client == "mobile" else "#3B82F6",
            "created_at": trail.created_at.isoformat() if trail.created_at else None,
            "profile_url": profile,
            "device": device_label,
            "os_name": device_label,
            "client": client,
            "user_id": u.id,
        })
    return rows



def amniga_analytics(user, *, range_str: str = "7d") -> dict:
    days = {"7d": 7, "30d": 30, "90d": 90}.get(range_str, 7)
    weekly_trend = _weekly_series(user, days=min(days, 7))
    daily_trend = _weekly_series(user, days=days) if days > 7 else weekly_trend

    force_status_breakdown: list[dict] = []
    if can_view_forces(user) and Force.objects.exists():
        total = Force.objects.count()
        status_rows = Force.objects.values("status").annotate(count=Count("id")).order_by("-count")
        for row in status_rows:
            count = row["count"]
            status = row["status"]
            pct = round((count / total) * 100) if total else 0
            force_status_breakdown.append({
                "label": status,
                "count": count,
                "pct": pct,
                "color": FORCE_STATUS_COLORS.get(status, "#9a8a6f"),
            })
    elif can_view_agents(user):
        total = Agent.objects.count()
        present_rows = Agent.objects.values("present").annotate(count=Count("id")).order_by("-count")
        for row in present_rows:
            count = row["count"]
            present = row["present"] or "Joogey"
            pct = round((count / total) * 100) if total else 0
            force_status_breakdown.append({
                "label": present,
                "count": count,
                "pct": pct,
                "color": AGENT_PRESENT_COLORS.get(present, "#9a8a6f"),
            })

    suspect_status_breakdown: list[dict] = []
    if can_view_suspects(user):
        total = Suspect.objects.count()
        status_rows = Suspect.objects.values("status").annotate(count=Count("id")).order_by("-count")
        for row in status_rows:
            count = row["count"]
            status = row["status"]
            pct = round((count / total) * 100) if total else 0
            suspect_status_breakdown.append({
                "label": status,
                "count": count,
                "pct": pct,
                "color": SUSPECT_STATUS_COLORS.get(status, "#9a8a6f"),
            })

    suspects_by_district: list[dict] = []
    if can_view_suspects(user):
        suspects_by_district = [
            {"name": row["district"] or "Unknown", "total": row["total"]}
            for row in (
                Suspect.objects.values("district")
                .annotate(total=Count("id"))
                .order_by("-total")[:6]
            )
        ]

    forces_by_unit: list[dict] = []
    if can_view_forces(user) and Force.objects.exists():
        forces_by_unit = [
            {"name": row["unit"] or "Unknown", "total": row["total"]}
            for row in (
                Force.objects.values("unit")
                .annotate(total=Count("id"))
                .order_by("-total")[:6]
            )
        ]
    elif can_view_agents(user):
        forces_by_unit = [
            {"name": row["county__name"] or "Unknown", "total": row["total"]}
            for row in (
                Agent.objects.exclude(county__isnull=True)
                .values("county__name")
                .annotate(total=Count("id"))
                .order_by("-total")[:6]
            )
        ]

    return {
        "weekly_trend": weekly_trend,
        "daily_trend": daily_trend,
        "breakdown": amniga_breakdown(user),
        "force_status_breakdown": force_status_breakdown,
        "suspect_status_breakdown": suspect_status_breakdown,
        "suspects_by_district": suspects_by_district,
        "forces_by_unit": forces_by_unit,
        "counties_chart": _counties_chart(user),
        "top_registrars": _top_registrars(user, limit=10),
        "user_activity_summary": _user_activity_summary(user),
        "recent_activity": amniga_recent_activity(user, limit=5),
    }


def _parse_report_date(date_str: str | None):
    today = timezone.localdate()
    if not date_str:
        return today
    try:
        year, month, day = (int(part) for part in date_str.split("-", 2))
        return date_cls(year, month, day)
    except (TypeError, ValueError):
        return today


def _parse_report_range(
    *,
    date_str: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> tuple[date_cls, date_cls]:
    today = timezone.localdate()
    start = _parse_report_date(date_from) if date_from else None
    end = _parse_report_date(date_to) if date_to else None
    if start is None and end is None:
        day = _parse_report_date(date_str)
        return day, day
    if start is None:
        start = end or today
    if end is None:
        end = start
    if end < start:
        start, end = end, start
    return start, end


def _user_display_name(user) -> str:
    if not user:
        return "—"
    full = (user.get_full_name() or "").strip()
    if full:
        return full
    return user.username or user.email or "—"


_JUNK_COUNTY_RE = re.compile(r"^[\d\-./\s]+$")
_HAS_LETTER_RE = re.compile(r"[A-Za-zÀ-ÿ]")


def _is_real_county_name(name: str) -> bool:
    n = (name or "").strip()
    if len(n) < 2:
        return False
    if _JUNK_COUNTY_RE.fullmatch(n):
        return False
    return bool(_HAS_LETTER_RE.search(n))


def _real_counties() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for county in County.objects.select_related("region").only("id", "name", "region_id", "region__name"):
        name = (county.name or "").strip()
        if not _is_real_county_name(name):
            continue
        out[name.lower()] = {
            "id": county.id,
            "name": name,
            "region": county.region.name if county.region_id else "",
        }
    return out


def _district_match_q(district: str, prefix: str = "") -> Q:
    """Any link to the district (capture OR residence OR address). May overlap districts."""
    p = f"{prefix}__" if prefix else ""
    return (
        Q(**{f"{p}capture_county__name__iexact": district})
        | Q(**{f"{p}district__iexact": district})
        | Q(**{f"{p}address__name__iexact": district})
    )


def _district_exclusive_match_q(county, prefix: str = "") -> Q:
    """Same single-district attribution as Shaqada Degmooyinka list (no double-count).

    Priority: capture county → else residence text → else address county.
    """
    p = f"{prefix}__" if prefix else ""
    return (
        Q(**{f"{p}capture_county_id": county.id})
        | (
            Q(**{f"{p}capture_county_id": None})
            & Q(**{f"{p}district__iexact": county.name})
        )
        | (
            Q(**{f"{p}capture_county_id": None})
            & Q(**{f"{p}district": ""})
            & Q(**{f"{p}address_id": county.id})
        )
    )


def _county_user_stats(county_ids: list[int]) -> dict[int, dict]:
    if not county_ids:
        return {}
    return {
        r["county_id"]: r
        for r in User.objects.filter(county_id__in=county_ids)
        .values("county_id")
        .annotate(
            total_users=Count("id"),
            active_users=Count("id", filter=Q(is_active=True, suspend=False)),
        )
    }


def _selected_district_activity_row(suspects_qs, district: str, counties: dict[str, dict]) -> list[dict]:
    """When a district filter is active, attribute the whole page to that district.

    Matching suspects may have capture/residence elsewhere (e.g. address=Cabdicasiis
    but capture_county=Boondheere). Re-bucketing by capture would show the wrong name.
    """
    district = (district or "").strip()
    if not district:
        return []
    meta = counties.get(district.lower())
    if meta is None:
        county = (
            County.objects.select_related("region")
            .filter(name__iexact=district)
            .first()
        )
        if county is None or not _is_real_county_name(county.name):
            return []
        meta = {
            "id": county.id,
            "name": county.name,
            "region": county.region.name if county.region_id else "",
        }
    suspects_total = suspects_qs.count()
    capture = suspects_qs.filter(capture_county_id=meta["id"]).count()
    residence = suspects_qs.filter(
        Q(district__iexact=meta["name"]) | Q(address_id=meta["id"])
    ).count()
    user_stats = _county_user_stats([meta["id"]]).get(meta["id"], {})
    return [{
        "id": meta["id"],
        "name": meta["name"],
        "region": meta["region"],
        "suspects": suspects_total,
        "capture": capture,
        "residence": residence,
        "share_pct": 100.0 if suspects_total else 0.0,
        "active_users": user_stats.get("active_users", 0),
        "total_users": user_stats.get("total_users", 0),
    }]


def _district_activity_rows(suspects_qs, *, counties: dict[str, dict] | None = None, limit: int = 20) -> list[dict]:
    """Rank county districts by suspects registered in the queryset (no double-count)."""
    counties = counties if counties is not None else _real_counties()
    if not counties:
        return []

    totals: dict[str, dict] = {}

    def bump(key: str, *, capture: int = 0, residence: int = 0) -> None:
        meta = counties.get(key)
        if not meta:
            return
        row = totals.setdefault(
            key,
            {
                "id": meta["id"],
                "name": meta["name"],
                "region": meta["region"],
                "suspects": 0,
                "capture": 0,
                "residence": 0,
            },
        )
        row["capture"] += capture
        row["residence"] += residence
        row["suspects"] += capture + residence

    for row in (
        suspects_qs.exclude(capture_county_id=None)
        .values("capture_county_id", "capture_county__name")
        .annotate(total=Count("id"))
    ):
        bump((row["capture_county__name"] or "").strip().lower(), capture=row["total"])

    for row in (
        suspects_qs.filter(capture_county_id=None)
        .exclude(district="")
        .values("district")
        .annotate(total=Count("id"))
    ):
        bump((row["district"] or "").strip().lower(), residence=row["total"])

    for row in (
        suspects_qs.filter(capture_county_id=None, district="")
        .exclude(address_id=None)
        .values("address_id", "address__name")
        .annotate(total=Count("id"))
    ):
        bump((row["address__name"] or "").strip().lower(), residence=row["total"])

    if not totals:
        return []

    user_stats = _county_user_stats([row["id"] for row in totals.values()])

    period_total = suspects_qs.count() or 1
    ranked = sorted(totals.values(), key=lambda item: (-item["suspects"], item["name"]))[:limit]
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "region": row["region"],
            "suspects": row["suspects"],
            "capture": row["capture"],
            "residence": row["residence"],
            "share_pct": round((row["suspects"] / period_total) * 100, 1),
            "active_users": user_stats.get(row["id"], {}).get("active_users", 0),
            "total_users": user_stats.get(row["id"], {}).get("total_users", 0),
        }
        for row in ranked
    ]


def _max_dt(*values):
    dts = [v for v in values if v is not None]
    return max(dts) if dts else None


def last_seen_by_user_ids(user_ids) -> dict:
    """Latest agent activity: Django last_login, GPS ping, or suspect registration."""
    ids = [int(uid) for uid in user_ids if uid not in (None, "")]
    if not ids:
        return {}
    logins = {
        uid: ts
        for uid, ts in User.objects.filter(pk__in=ids).values_list("id", "last_login")
        if ts
    }
    gps = dict(
        UserLocation.objects.filter(user_id__in=ids)
        .values("user_id")
        .annotate(ts=Max("last_updated"))
        .values_list("user_id", "ts")
    )
    suspects = dict(
        Suspect.objects.filter(created_by_id__in=ids)
        .values("created_by_id")
        .annotate(ts=Max("created_at"))
        .values_list("created_by_id", "ts")
    )
    out = {}
    for uid in ids:
        ts = _max_dt(logins.get(uid), gps.get(uid), suspects.get(uid))
        if ts:
            out[uid] = ts
    return out


def _iso_or_none(value):
    return value.isoformat() if value else None


def _registrar_row(row: dict) -> dict:
    first = (row.get("created_by__first_name") or "").strip()
    last = (row.get("created_by__last_name") or "").strip()
    name = f"{first} {last}".strip() or row.get("created_by__username") or row.get("created_by__email") or "—"
    last_login = row.get("created_by__last_login")
    return {
        "id": row["created_by_id"],
        "name": name,
        "phone": row.get("created_by__phone") or "",
        "county_name": row.get("created_by__county__name") or "",
        "total": row["total"],
        "last_login": last_login.isoformat() if last_login else None,
        "is_active": bool(row.get("created_by__is_active") and not row.get("created_by__suspend")),
    }


def amniga_daily_report(
    user,
    *,
    date_str: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    district: str = "",
) -> dict:
    """Suspect operations report — filters by calendar day/range and optional county district."""
    start, end = _parse_report_range(date_str=date_str, date_from=date_from, date_to=date_to)
    district = (district or "").strip()
    date_filter = {"created_at__date__gte": start, "created_at__date__lte": end}

    suspects_qs = Suspect.objects.filter(**date_filter)
    if district:
        suspects_qs = suspects_qs.filter(_district_match_q(district))

    suspects_registered = suspects_qs.count()

    damiin_qs = Damiinada.objects.filter(**date_filter)
    if district:
        damiin_qs = damiin_qs.filter(
            Q(county__name__iexact=district) | Q(sub_county__name__iexact=district)
        )
    damiin_created = damiin_qs.count()

    counties = _real_counties()
    county_keys = set(counties)
    if district:
        district_activity = _selected_district_activity_row(suspects_qs, district, counties)
    else:
        district_activity = _district_activity_rows(suspects_qs, counties=counties, limit=25)
    capture_totals = {row["name"]: row["suspects"] for row in district_activity}
    capture_by_district = [
        {"name": row["name"], "total": row["suspects"]}
        for row in district_activity[:10]
    ]

    if district:
        selected_name = district_activity[0]["name"] if district_activity else district
        residence_by_district = (
            [{"name": selected_name, "total": district_activity[0]["residence"]}]
            if district_activity and district_activity[0]["residence"]
            else []
        )
    else:
        residence_by_district = [
            {"name": (row["district"] or "").strip() or "Unknown", "total": row["total"]}
            for row in (
                suspects_qs.exclude(district="")
                .values("district")
                .annotate(total=Count("id"))
                .order_by("-total")[:20]
            )
            if (row["district"] or "").strip().lower() in county_keys
        ][:10]

    top_registrars = []
    for row in (
        suspects_qs.exclude(created_by__isnull=True)
        .values(
            "created_by_id",
            "created_by__first_name",
            "created_by__last_name",
            "created_by__username",
            "created_by__phone",
            "created_by__email",
        )
        .annotate(total=Count("id"))
        .order_by("-total")[:10]
    ):
        first = (row["created_by__first_name"] or "").strip()
        last = (row["created_by__last_name"] or "").strip()
        name = f"{first} {last}".strip() or row["created_by__username"] or row["created_by__email"] or "—"
        top_registrars.append({
            "id": row["created_by_id"],
            "name": name,
            "phone": row["created_by__phone"] or "",
            "total": row["total"],
        })

    comments_qs = SuspectComment.objects.filter(
        created_at__date__gte=start,
        created_at__date__lte=end,
        parent__isnull=True,
    ).select_related("suspect")
    if district:
        comments_qs = comments_qs.filter(_district_match_q(district, prefix="suspect"))
    latest_comments = [
        {
            "id": comment.id,
            "author_name": comment.author_name,
            "body": comment.body,
            "suspect_id": comment.suspect_id,
            "suspect_name": comment.suspect.name if comment.suspect_id else "",
            "created_at": comment.created_at.isoformat(),
        }
        for comment in comments_qs[:8]
    ]

    responses_qs = SuspectResponse.objects.filter(
        created_at__date__gte=start,
        created_at__date__lte=end,
    ).select_related("suspect", "user")
    if district:
        responses_qs = responses_qs.filter(_district_match_q(district, prefix="suspect"))
    latest_responses = [
        {
            "id": response.id,
            "details": response.details,
            "author_name": _user_display_name(response.user),
            "suspect_id": response.suspect_id,
            "suspect_name": response.suspect.name if response.suspect_id else "",
            "created_at": response.created_at.isoformat(),
        }
        for response in responses_qs[:8]
    ]

    # Same date (+ district) window as the rest of the report — not all-time.
    repeat_qs = (
        suspects_qs.annotate(case_count=Count("cases", distinct=True))
        .filter(case_count__gt=1)
        .select_related("suspect_type", "capture_county")
        .order_by("-case_count", "-updated_at")
    )
    repeat_offenders = [
        {
            "id": suspect.id,
            "name": suspect.name,
            "mother_name": suspect.mother_name or "",
            "phone": suspect.phone or "",
            "district": (
                (suspect.capture_county.name if suspect.capture_county_id else "")
                or suspect.district
                or ""
            ),
            "status": suspect.status,
            "tuhunka": suspect.suspect_type.name if suspect.suspect_type_id else "",
            "case_count": suspect.case_count,
            "bail_count": suspect.bail_count,
        }
        for suspect in repeat_qs[:15]
    ]

    return {
        "date": start.isoformat(),
        "date_from": start.isoformat(),
        "date_to": end.isoformat(),
        "district": district,
        "summary": {
            "suspects_registered": suspects_registered,
            "damiin_created": damiin_created,
            "capture_districts": len(capture_totals),
        },
        "district_activity": district_activity,
        "capture_by_district": capture_by_district,
        "residence_by_district": residence_by_district,
        "top_registrars": top_registrars,
        "latest_comments": latest_comments,
        "latest_responses": latest_responses,
        "repeat_offenders": repeat_offenders,
    }


def amniga_district_profile(
    user,
    *,
    district: str,
    date_str: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict | None:
    """County district profile — activity, top registrars, and assigned officers."""
    district = (district or "").strip()
    if not district:
        return None
    county = (
        County.objects.select_related("region")
        .filter(name__iexact=district)
        .first()
    )
    if not county or not _is_real_county_name(county.name):
        return None

    start, end = _parse_report_range(date_str=date_str, date_from=date_from, date_to=date_to)
    date_filter = {"created_at__date__gte": start, "created_at__date__lte": end}
    period_suspects = Suspect.objects.filter(**date_filter)
    # Headline / charts use exclusive attribution so counts match the county list.
    district_suspects = period_suspects.filter(_district_exclusive_match_q(county))
    suspects_registered = district_suspects.count()
    total_period = period_suspects.count()

    # Breakdown cards stay inclusive (a resident captured elsewhere still shows here).
    capture_count = period_suspects.filter(capture_county_id=county.id).count()
    residence_count = period_suspects.filter(
        Q(district__iexact=county.name) | Q(address_id=county.id)
    ).count()

    damiin_created = Damiinada.objects.filter(**date_filter).filter(
        Q(county_id=county.id)
        | Q(county__name__iexact=county.name)
        | Q(sub_county__county_id=county.id)
    ).count()

    user_agg = User.objects.filter(county_id=county.id).aggregate(
        total_users=Count("id"),
        active_users=Count("id", filter=Q(is_active=True, suspend=False)),
    )

    status_rows = (
        district_suspects.values("status")
        .annotate(total=Count("id"))
        .order_by("-total")
    )
    status_labels = dict(Suspect.Status.choices)
    status_breakdown = [
        {
            "key": row["status"] or "unknown",
            "label": status_labels.get(row["status"], row["status"] or "Unknown"),
            "total": row["total"],
            "pct": round((row["total"] / suspects_registered) * 100, 1) if suspects_registered else 0,
            "color": SUSPECT_STATUS_COLORS.get(row["status"], "#9a8a6f"),
        }
        for row in status_rows
    ]

    span = (end - start).days + 1
    if span <= 42:
        trunc = TruncDate("created_at")
        grain = "day"
    else:
        trunc = TruncMonth("created_at")
        grain = "month"
    trend = [
        {
            "date": row["bucket"].date().isoformat() if hasattr(row["bucket"], "date") else row["bucket"].isoformat(),
            "total": row["total"],
        }
        for row in (
            district_suspects.annotate(bucket=trunc)
            .values("bucket")
            .annotate(total=Count("id"))
            .order_by("bucket")
        )
        if row["bucket"]
    ]

    registrar_rows = list(
        district_suspects.exclude(created_by_id=None)
        .values(
            "created_by_id",
            "created_by__first_name",
            "created_by__last_name",
            "created_by__username",
            "created_by__phone",
            "created_by__email",
            "created_by__county__name",
            "created_by__last_login",
            "created_by__is_active",
            "created_by__suspend",
        )
        .annotate(total=Count("id"))
        .order_by("-total")[:15]
    )
    top_registrars = [_registrar_row(row) for row in registrar_rows]

    period_rel = Q(
        registered_suspects__created_at__date__gte=start,
        registered_suspects__created_at__date__lte=end,
    )
    district_rel = period_rel & _district_exclusive_match_q(county, prefix="registered_suspects")
    officers = list(
        User.objects.filter(county_id=county.id)
        .annotate(
            period_registrations=Count("registered_suspects", filter=period_rel),
            district_registrations=Count("registered_suspects", filter=district_rel),
        )
        .order_by("-district_registrations", "-period_registrations", "-last_login")[:20]
    )
    last_seen = last_seen_by_user_ids(
        [row["id"] for row in top_registrars] + [officer.pk for officer in officers]
    )
    for row in top_registrars:
        row["last_login"] = _iso_or_none(last_seen.get(row["id"]))
    assigned_officers = []
    for officer in officers:
        assigned_officers.append({
            "id": officer.pk,
            "name": _user_display_name(officer),
            "phone": officer.phone or "",
            "last_login": _iso_or_none(last_seen.get(officer.pk)),
            "is_active": bool(officer.is_active and not officer.suspend),
            "period_registrations": officer.period_registrations,
            "district_registrations": officer.district_registrations,
        })

    recent_suspects = [
        {
            "id": suspect.id,
            "name": suspect.name,
            "mother_name": suspect.mother_name or "",
            "phone": suspect.phone or "",
            "status": suspect.status,
            "tuhunka": suspect.suspect_type.name if suspect.suspect_type_id else "",
            "created_at": suspect.created_at.isoformat(),
            "registrar_name": _user_display_name(suspect.created_by),
        }
        for suspect in (
            district_suspects.select_related("suspect_type", "created_by")
            .order_by("-created_at")[:12]
        )
    ]

    registrar_count = (
        district_suspects.exclude(created_by_id=None)
        .values("created_by_id")
        .distinct()
        .count()
    )

    return {
        "date_from": start.isoformat(),
        "date_to": end.isoformat(),
        "district": {
            "id": county.id,
            "name": county.name,
            "region": county.region.name if county.region_id else "",
        },
        "summary": {
            "suspects_registered": suspects_registered,
            "capture_count": capture_count,
            "residence_count": residence_count,
            "damiin_created": damiin_created,
            "share_pct": round((suspects_registered / total_period) * 100, 1) if total_period else 0,
            "registrar_count": registrar_count,
            "active_users": user_agg["active_users"] or 0,
            "total_users": user_agg["total_users"] or 0,
        },
        "status_breakdown": status_breakdown,
        "trend": trend,
        "trend_grain": grain,
        "top_registrars": top_registrars,
        "assigned_officers": assigned_officers,
        "recent_suspects": recent_suspects,
    }
