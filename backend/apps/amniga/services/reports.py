"""C.I.Sh reports — optimized list + summary queries."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.accounts.models import County
from apps.amniga.services.queries import (
    _district_activity_rows,
    _is_real_county_name,
    _parse_report_range,
    _real_counties,
    last_seen_by_user_ids,
)
from apps.mobile.models import UserLocation
from apps.suspects.models import Suspect

User = get_user_model()

_DEV_USER_TYPES = ("dev", "developer")


def _viewer_can_see_privileged_agents(viewer) -> bool:
    """Developers / super admins may see every agent on the GPS track map."""
    if not viewer or not getattr(viewer, "is_authenticated", False):
        return False
    if viewer.is_superuser or viewer.is_staff or getattr(viewer, "is_admin", False):
        return True
    user_type = getattr(viewer, "user_type", None)
    name = (getattr(user_type, "name", None) or "").strip().lower()
    return name in _DEV_USER_TYPES


def _privileged_agent_q() -> Q:
    return (
        Q(is_superuser=True)
        | Q(is_staff=True)
        | Q(user_type__name__iexact="dev")
        | Q(user_type__name__iexact="developer")
    )


def _track_map_users_qs(*, viewer=None):
    """Field agents for GPS tracking. Non-privileged viewers never see developer/superuser accounts."""
    qs = (
        User.objects.filter(is_agent=True)
        .select_related("county", "agent_profile", "user_type")
        .order_by("first_name", "last_name", "username")
    )
    if _viewer_can_see_privileged_agents(viewer):
        return qs
    return qs.exclude(_privileged_agent_q())


def _agent_search_q(search: str) -> Q:
    q = (search or "").strip()
    if not q:
        return Q()
    combined = Q()
    for part in [p for p in q.split() if p]:
        combined &= (
            Q(username__icontains=part)
            | Q(first_name__icontains=part)
            | Q(last_name__icontains=part)
            | Q(email__icontains=part)
            | Q(phone__icontains=part)
        )
    return combined


def _restricted_track_match(*, viewer, search: str | None = None, user_id: str | int | None = None) -> bool:
    """True when the request targets a developer/superuser the viewer is not allowed to track."""
    if _viewer_can_see_privileged_agents(viewer):
        return False
    privileged = User.objects.filter(is_agent=True).filter(_privileged_agent_q())
    if user_id is not None and str(user_id).strip():
        ref = str(user_id).strip()
        hit = privileged.filter(username__iexact=ref)
        if ref.isdigit():
            hit = privileged.filter(Q(pk=int(ref)) | Q(username__iexact=ref))
        if hit.exists():
            return True
    q = (search or "").strip()
    if q and privileged.filter(_agent_search_q(q)).exists():
        return True
    return False


def _page_params(page: int, page_size: int) -> tuple[int, int]:
    return max(1, page), min(max(1, page_size), 100)


def _user_base_qs(*, search: str, county: str, active_only: bool):
    qs = User.objects.select_related("county").only(
        "id",
        "first_name",
        "last_name",
        "username",
        "email",
        "gender",
        "phone",
        "mobile_type",
        "is_active",
        "suspend",
        "last_login",
        "county_id",
        "county__name",
    )
    if active_only:
        qs = qs.filter(is_active=True, suspend=False)
    if county:
        qs = qs.filter(county_id=county)
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(username__icontains=search)
            | Q(email__icontains=search)
            | Q(phone__icontains=search)
        )
    return qs


def user_activity_report(
    *,
    search: str = "",
    county: str = "",
    page: int = 1,
    page_size: int = 10,
    active_only: bool = False,
    top_users: bool = False,
) -> dict:
    """Warbixinta Isticmaalayaasha."""
    page, page_size = _page_params(page, page_size)
    today = timezone.localdate()
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

    suspects_sq = (
        Suspect.objects.filter(created_by_id=OuterRef("pk"))
        .order_by()
        .values("created_by_id")
        .annotate(c=Count("id"))
        .values("c")[:1]
    )

    qs = _user_base_qs(search=search, county=county, active_only=active_only).annotate(
        suspects_registered=Coalesce(Subquery(suspects_sq, output_field=IntegerField()), Value(0)),
    )

    # One summary query (no per-row annotation cost on full table scan for counts).
    summary = _user_base_qs(search=search, county=county, active_only=active_only).aggregate(
        total_users=Count("id"),
        active_users=Count("id", filter=Q(is_active=True, suspend=False)),
        logged_today=Count("id", filter=Q(last_login__gte=today_start)),
        never_login=Count("id", filter=Q(last_login__isnull=True)),
    )
    total_users = summary["total_users"] or 0
    active_users = summary["active_users"] or 0

    suspects_filter = Q()
    if county:
        suspects_filter &= Q(created_by__county_id=county)
    if active_only:
        suspects_filter &= Q(created_by__is_active=True, created_by__suspend=False)
    if search:
        suspects_filter &= (
            Q(created_by__first_name__icontains=search)
            | Q(created_by__last_name__icontains=search)
            | Q(created_by__email__icontains=search)
            | Q(created_by__phone__icontains=search)
        )
    total_suspects = Suspect.objects.filter(suspects_filter).count() if (
        county or active_only or search
    ) else Suspect.objects.count()

    mobile_rows = list(
        _user_base_qs(search=search, county=county, active_only=active_only)
        .values("mobile_type")
        .annotate(total=Count("id"))
        .order_by("-total")[:6]
    )
    mobile_breakdown = [
        {"name": (row["mobile_type"] or "").strip() or "No Phone", "total": row["total"]}
        for row in mobile_rows
    ]

    if top_users:
        qs = qs.order_by("-suspects_registered", "first_name", "last_name")
    else:
        qs = qs.order_by("first_name", "last_name", "email")

    total = total_users
    start = (page - 1) * page_size
    page_rows = list(qs[start : start + page_size])

    last_seen = last_seen_by_user_ids([user.pk for user in page_rows])
    results = []
    for i, user in enumerate(page_rows, start=start + 1):
        last_login = last_seen.get(user.pk) or user.last_login
        today_login = int(
            bool(last_login and timezone.localtime(last_login).date() == today)
        )
        results.append({
            "no": i,
            "id": user.pk,
            "name": (user.get_full_name() or "").strip() or user.username,
            "email": user.email,
            "gender": user.gender or "",
            "phone": user.phone or "",
            "county_name": user.county.name if user.county_id else "",
            "mobile_type": (user.mobile_type or "").strip() or "No Phone",
            "suspects_registered": user.suspects_registered,
            "last_login": last_login.isoformat() if last_login else None,
            "today_login": today_login,
            "is_active": bool(user.is_active and not user.suspend),
        })

    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_users": total_users,
        "total_suspects": total_suspects,
        "mobile_breakdown": mobile_breakdown,
        "status_breakdown": [
            {"name": "Active", "total": active_users},
            {"name": "Inactive", "total": max(0, total_users - active_users)},
        ],
        "activity_breakdown": [
            {"name": "Logged today", "total": summary["logged_today"] or 0},
            {"name": "Never login", "total": summary["never_login"] or 0},
        ],
        "results": results,
    }


def district_work_report(
    *,
    search: str = "",
    page: int = 1,
    page_size: int = 10,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Shaqada Degmooyinka — county activity for a day/week/month/range."""
    page, page_size = _page_params(page, page_size)
    start, end = _parse_report_range(date_from=date_from, date_to=date_to)
    search = (search or "").strip()

    users_sq_total = (
        User.objects.filter(county_id=OuterRef("pk"))
        .order_by()
        .values("county_id")
        .annotate(c=Count("id"))
        .values("c")[:1]
    )
    users_sq_active = (
        User.objects.filter(county_id=OuterRef("pk"), is_active=True, suspend=False)
        .order_by()
        .values("county_id")
        .annotate(c=Count("id"))
        .values("c")[:1]
    )

    qs = County.objects.select_related("region").only("id", "name", "region_id", "region__name")
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(region__name__icontains=search))
    qs = qs.annotate(
        total_users=Coalesce(Subquery(users_sq_total, output_field=IntegerField()), Value(0)),
        active_users=Coalesce(Subquery(users_sq_active, output_field=IntegerField()), Value(0)),
    )

    counties = [c for c in qs if _is_real_county_name(c.name or "")]
    county_meta = _real_counties()
    suspects_qs = Suspect.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
    activity = {
        row["id"]: row
        for row in _district_activity_rows(suspects_qs, counties=county_meta, limit=500)
    }

    rows = []
    for county in counties:
        act = activity.get(county.pk, {})
        total_users = county.total_users
        active_users = county.active_users
        rows.append({
            "id": county.pk,
            "name": county.name,
            "region": county.region.name if county.region_id else "",
            "suspects": int(act.get("suspects") or 0),
            "capture": int(act.get("capture") or 0),
            "residence": int(act.get("residence") or 0),
            "share_pct": float(act.get("share_pct") or 0),
            "active_users": active_users,
            "inactive_users": max(0, total_users - active_users),
            "total_users": total_users,
        })

    rows.sort(key=lambda r: (-r["suspects"], -r["total_users"], r["name"]))
    total = len(rows)
    offset = (page - 1) * page_size
    page_rows = rows[offset : offset + page_size]
    results = [{"no": offset + i, **row} for i, row in enumerate(page_rows, start=1)]

    user_totals = User.objects.filter(county_id__in=[c.pk for c in counties]).aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(is_active=True, suspend=False)),
    )

    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "date_from": start.isoformat(),
        "date_to": end.isoformat(),
        "total_suspects": suspects_qs.count(),
        "total_users": user_totals["total"] or 0,
        "active_users": user_totals["active"] or 0,
        "results": results,
    }


def _agent_id_last4(username: str | None, pk: int) -> str:
    code = (username or "").strip()
    digits = "".join(ch for ch in code if ch.isdigit())
    if len(digits) >= 4:
        return digits[-4:]
    if len(code) >= 4:
        return code[-4:]
    return str(pk)[-4:].zfill(4)


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    from math import atan2, cos, radians, sin, sqrt

    r = 6371.0
    dlat = radians(b[0] - a[0])
    dlng = radians(b[1] - a[1])
    h = sin(dlat / 2) ** 2 + cos(radians(a[0])) * cos(radians(b[0])) * sin(dlng / 2) ** 2
    return 2 * r * atan2(sqrt(h), sqrt(1 - h))


def _parse_user_coords(lat, lng) -> tuple[float, float] | None:
    try:
        la = float(str(lat).strip())
        lo = float(str(lng).strip())
    except (TypeError, ValueError, AttributeError):
        return None
    if abs(la) < 0.01 and abs(lo) < 0.01:
        return None
    if not (-90 <= la <= 90 and -180 <= lo <= 180):
        return None
    # Whole-number placeholders like (6, 48) are not real GPS fixes.
    if la == int(la) and lo == int(lo):
        return None
    return la, lo


def _clean_track_points(raw: list[dict]) -> list[dict]:
    """Drop fake/duplicate GPS and keep every distinct place in time order."""
    parsed: list[dict] = []
    for row in raw:
        coords = _parse_user_coords(row.get("latitude"), row.get("longitude"))
        if coords is None:
            continue
        lat, lng = coords
        parsed.append({**row, "latitude": lat, "longitude": lng})

    deduped: list[dict] = []
    for row in parsed:
        if deduped:
            prev = deduped[-1]
            if _haversine_km((prev["latitude"], prev["longitude"]), (row["latitude"], row["longitude"])) < 0.012:
                deduped[-1] = row
                continue
        deduped.append(row)

    cleaned: list[dict] = []
    n = len(deduped)
    for i, row in enumerate(deduped):
        here = (row["latitude"], row["longitude"])
        if n >= 2 and i == 0:
            nxt = (deduped[1]["latitude"], deduped[1]["longitude"])
            if _haversine_km(here, nxt) > 40:
                continue
        elif n >= 2 and i == n - 1:
            prev = (deduped[i - 1]["latitude"], deduped[i - 1]["longitude"])
            if _haversine_km(prev, here) > 40:
                continue
        elif 0 < i < n - 1:
            prev = (deduped[i - 1]["latitude"], deduped[i - 1]["longitude"])
            nxt = (deduped[i + 1]["latitude"], deduped[i + 1]["longitude"])
            d_prev = _haversine_km(prev, here)
            d_next = _haversine_km(here, nxt)
            d_span = _haversine_km(prev, nxt)
            if d_prev > 40 and d_next > 40 and d_span < min(d_prev, d_next):
                continue
        cleaned.append(row)
    return cleaned


def user_track_map_report(
    *,
    user_id: str | int | None = None,
    hours: int = 24,
    viewer=None,
    search: str | None = None,
) -> dict:
    """GIS track report for field agents — trail + last-known positions + on-duty status."""
    try:
        hours = int(hours)
    except (TypeError, ValueError):
        hours = 24
    hours = max(0, min(hours, 8760))
    since = None if hours == 0 else timezone.now() - timedelta(hours=hours)
    live_since = timezone.now() - timedelta(hours=6)
    search_q = (search or "").strip()

    track_qs = UserLocation.objects.filter(user_id__isnull=False)
    if since is not None:
        active_track_user_ids = set(
            track_qs.filter(last_updated__gte=since).values_list("user_id", flat=True).distinct()
        )
    else:
        active_track_user_ids = set(track_qs.values_list("user_id", flat=True).distinct())

    latest_by_user = {
        row.user_id: row
        for row in (
            UserLocation.objects.filter(user_id__isnull=False)
            .exclude(latitude=None)
            .exclude(longitude=None)
            .order_by("user_id", "-last_updated")
            .distinct("user_id")
            .only("user_id", "latitude", "longitude", "last_updated")
        )
    }
    track_counts = dict(
        UserLocation.objects.filter(user_id__isnull=False)
        .values("user_id")
        .annotate(c=Count("id"))
        .values_list("user_id", "c")
    )

    users_qs = _track_map_users_qs(viewer=viewer)
    users = []
    markers = []
    on_duty_count = 0
    with_gps_count = 0
    in_field_count = 0
    for u in users_qs:
        profile = getattr(u, "agent_profile", None)
        present = (getattr(profile, "present", None) or "").strip()
        agent_status = (getattr(profile, "status", None) or "").strip()
        on_duty = bool(
            present == "Joogey"
            and (not agent_status or agent_status.lower() == "active")
            and u.is_active
            and not u.suspend
        )
        latest = latest_by_user.get(u.pk)
        coords = None
        last_seen = None
        if latest is not None:
            coords = _parse_user_coords(latest.latitude, latest.longitude)
            last_seen = latest.last_updated
        if coords is None:
            coords = _parse_user_coords(u.latitude, u.longitude)
        in_field = bool(last_seen and last_seen >= live_since)
        has_gps = coords is not None
        if on_duty:
            on_duty_count += 1
        if has_gps:
            with_gps_count += 1
        if in_field:
            in_field_count += 1
        row = {
            "id": u.pk,
            "user_code": (u.username or str(u.pk)).strip(),
            "id_last4": _agent_id_last4(u.username, u.pk),
            "name": (u.get_full_name() or "").strip() or u.username or u.email or f"User {u.pk}",
            "phone": u.phone or "",
            "county_name": u.county.name if u.county_id else "",
            "has_track": u.pk in active_track_user_ids,
            "track_count": int(track_counts.get(u.pk, 0)),
            "has_gps": has_gps,
            "on_duty": on_duty,
            "in_field": in_field,
            "present": present or "",
            "last_seen": timezone.localtime(last_seen).isoformat() if last_seen else None,
            "last_latitude": coords[0] if coords else None,
            "last_longitude": coords[1] if coords else None,
        }
        users.append(row)
        if coords:
            markers.append({
                "id": u.pk,
                "user_code": row["user_code"],
                "id_last4": row["id_last4"],
                "name": row["name"],
                "county_name": row["county_name"],
                "on_duty": on_duty,
                "in_field": in_field,
                "track_count": row["track_count"],
                "last_seen": row["last_seen"],
                "latitude": coords[0],
                "longitude": coords[1],
            })

    selected_user_ref = None
    selected_user_id = None
    selected_denied = False
    if user_id:
        requested_ref = str(user_id).strip()
        selected = next((u for u in users if str(u["user_code"]).lower() == requested_ref.lower()), None)
        if selected is None and requested_ref.isdigit():
            selected = next((u for u in users if u["id"] == int(requested_ref)), None)
        selected_user_id = selected["id"] if selected else None
        selected_user_ref = selected["user_code"] if selected else requested_ref
        if selected is None and _restricted_track_match(viewer=viewer, user_id=requested_ref):
            selected_denied = True
    search_denied = False
    if search_q and _restricted_track_match(viewer=viewer, search=search_q):
        # Only flag when the query does not also match a visible field agent.
        visible_hit = any(
            search_q.lower() in (u["name"] or "").lower()
            or search_q.lower() in (u["user_code"] or "").lower()
            or search_q.lower() in (u.get("phone") or "").lower()
            or search_q in str(u["id"])
            or search_q in (u.get("id_last4") or "")
            for u in users
        )
        if not visible_hit:
            search_denied = True
            selected_user_id = None
            selected_user_ref = None
    points = []
    summary = {
        "point_count": 0,
        "latest_at": None,
        "agents_total": len(users),
        "agents_on_duty": on_duty_count,
        "agents_with_gps": with_gps_count,
        "agents_in_field": in_field_count,
    }
    if selected_user_id:
        locations = UserLocation.objects.filter(user_id=selected_user_id)
        if since is not None:
            locations = locations.filter(last_updated__gte=since)
        locations = locations.order_by("last_updated")
        raw_points = [
            {
                "id": loc.pk,
                "latitude": float(loc.latitude),
                "longitude": float(loc.longitude),
                "timestamp": timezone.localtime(loc.last_updated).isoformat(),
            }
            for loc in locations
            if loc.latitude is not None and loc.longitude is not None
        ]
        points = _clean_track_points(raw_points)
        summary["point_count"] = len(points)
        summary["raw_point_count"] = len(raw_points)
        summary["latest_at"] = points[-1]["timestamp"] if points else None

    return {
        "hours": hours,
        "selected_user_id": selected_user_id,
        "selected_user_ref": selected_user_ref,
        "selected_denied": selected_denied,
        "search_denied": search_denied,
        "users": users,
        "markers": markers,
        "points": points,
        "summary": summary,
    }
