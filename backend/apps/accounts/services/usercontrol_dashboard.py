"""Aggregated analytics for the User Control module dashboard."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import Agent
from apps.audit.models import APITrafficLog, AuditTrail, ErrorLog
from apps.mobile.helpers import APP_LOGIN_ACTION

User = get_user_model()

ROLE_COLORS = {
    "admin": "#5b9fd4",
    "officer": "#46c08a",
    "agent": "#f0a04a",
    "user": "#9a8a6f",
}

EVENT_COLORS = {
    "login": "#5b9fd4",
    "logout": "#9a8a6f",
    "create": "#46c08a",
    "update": "#f0a04a",
    "delete": "#e0655a",
    "view": "#8B5CF6",
    "visit": "#06B6D4",
    "click": "#EC4899",
    "other": "#64748b",
}


def _pct(part: int, whole: int) -> int:
    return round((part / whole) * 100) if whole else 0


def _login_q() -> Q:
    return (
        Q(action__startswith=APP_LOGIN_ACTION)
        | Q(event_type=AuditTrail.EventType.LOGIN, path__icontains="/auth/login/")
        | Q(event_type=AuditTrail.EventType.LOGIN, action__startswith="User logged in")
    )


def _user_display(user) -> str:
    if not user:
        return "—"
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return name or user.email or user.username or f"#{user.pk}"


def build_usercontrol_dashboard(*, recent_limit: int = 8) -> dict:
    today = timezone.localdate()
    week_start = today - timedelta(days=6)
    now = timezone.now()
    week_ago = now - timedelta(days=7)

    users = User.objects.aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(is_active=True, suspend=False)),
        suspended=Count("id", filter=Q(suspend=True)),
        admins=Count("id", filter=Q(is_admin=True)),
        officers=Count("id", filter=Q(is_officer=True)),
        agents=Count("id", filter=Q(is_agent=True)),
        staff=Count("id", filter=Q(is_staff=True)),
        mobile=Count("id", filter=Q(is_mobile=True)),
        never_login=Count("id", filter=Q(last_login__isnull=True)),
        joined_today=Count("id", filter=Q(date_joined__date=today)),
        joined_week=Count("id", filter=Q(date_joined__date__gte=week_start)),
    )
    total_users = users["total"] or 0

    # Mutual-exclusive-ish role buckets for the donut (priority: admin > officer > agent > user)
    role_admin = users["admins"] or 0
    role_officer = User.objects.filter(is_officer=True, is_admin=False).count()
    role_agent = User.objects.filter(is_agent=True, is_admin=False, is_officer=False).count()
    role_user = max(0, total_users - role_admin - role_officer - role_agent)
    role_items = [
        ("admin", "Admins", role_admin),
        ("officer", "Officers", role_officer),
        ("agent", "Agents", role_agent),
        ("user", "Users", role_user),
    ]
    role_breakdown = [
        {
            "key": key,
            "label": label,
            "count": count,
            "pct": _pct(count, total_users),
            "color": ROLE_COLORS[key],
        }
        for key, label, count in role_items
        if count > 0 or key == "user"
    ]

    audits_today = AuditTrail.objects.filter(created_at__date=today).count()
    errors_today = ErrorLog.objects.filter(created_at__date=today).count()
    traffic_today = APITrafficLog.objects.filter(created_at__date=today).count()
    total_audits = AuditTrail.objects.count()
    logins_today = AuditTrail.objects.filter(_login_q(), created_at__date=today).count()
    logins_week = AuditTrail.objects.filter(_login_q(), created_at__date__gte=week_start).count()

    login_by_day = {
        row["day"]: row["count"]
        for row in (
            AuditTrail.objects.filter(_login_q(), created_at__date__gte=week_start)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
        )
    }
    weekly_logins = []
    for i in range(7):
        day = week_start + timedelta(days=i)
        weekly_logins.append(
            {
                "date": day.isoformat(),
                "label": day.strftime("%a"),
                "count": login_by_day.get(day, 0),
            }
        )

    event_rows = (
        AuditTrail.objects.filter(created_at__gte=week_ago)
        .values("event_type")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    event_total = sum(r["count"] for r in event_rows) or 0
    event_breakdown = [
        {
            "key": row["event_type"] or "other",
            "label": (row["event_type"] or "other").replace("_", " ").title(),
            "count": row["count"],
            "pct": _pct(row["count"], event_total),
            "color": EVENT_COLORS.get(row["event_type"] or "other", EVENT_COLORS["other"]),
        }
        for row in event_rows[:8]
    ]

    recent_logins = []
    for trail in (
        AuditTrail.objects.filter(_login_q())
        .select_related("user", "user__county")
        .order_by("-created_at")[:recent_limit]
    ):
        user = trail.user
        action = trail.action or ""
        channel = "mobile" if action.startswith(APP_LOGIN_ACTION) else "web"
        recent_logins.append(
            {
                "id": trail.pk,
                "user": _user_display(user),
                "email": getattr(user, "email", None) if user else None,
                "county": getattr(getattr(user, "county", None), "name", None) if user else None,
                "channel": channel,
                "os": (trail.operating_system or "").strip() or "—",
                "browser": (trail.browser or "").strip() or "—",
                "ip": trail.ip_address,
                "created_at": trail.created_at.isoformat() if trail.created_at else None,
            }
        )

    recent_audits = []
    for trail in (
        AuditTrail.objects.select_related("user").order_by("-created_at")[:recent_limit]
    ):
        recent_audits.append(
            {
                "id": trail.pk,
                "user": _user_display(trail.user),
                "action": (trail.action or "")[:120],
                "event_type": trail.event_type,
                "module": trail.module or trail.submodule or "—",
                "created_at": trail.created_at.isoformat() if trail.created_at else None,
            }
        )

    recent_errors = []
    for err in ErrorLog.objects.select_related("user").order_by("-created_at")[:5]:
        recent_errors.append(
            {
                "id": err.pk,
                "user": _user_display(err.user),
                "expected_error": (err.expected_error or "")[:100],
                "path": err.path or "—",
                "status_code": err.status_code,
                "created_at": err.created_at.isoformat() if err.created_at else None,
            }
        )

    top_active = []
    for row in (
        AuditTrail.objects.filter(created_at__gte=week_ago, user_id__isnull=False)
        .values("user_id", "user__email", "user__first_name", "user__last_name", "user__username")
        .annotate(count=Count("id"))
        .order_by("-count")[:6]
    ):
        name = f"{row['user__first_name'] or ''} {row['user__last_name'] or ''}".strip()
        top_active.append(
            {
                "id": row["user_id"],
                "email": row["user__email"],
                "name": name or row["user__email"] or row["user__username"] or f"#{row['user_id']}",
                "count": row["count"],
            }
        )

    return {
        "users": users,
        "groups_total": Group.objects.count(),
        "agents_profiles": Agent.objects.count(),
        "audit": {
            "audits_today": audits_today,
            "errors_today": errors_today,
            "traffic_today": traffic_today,
            "total_audits": total_audits,
            "logins_today": logins_today,
            "logins_week": logins_week,
        },
        "weekly_logins": weekly_logins,
        "role_breakdown": role_breakdown,
        "event_breakdown": event_breakdown,
        "recent_logins": recent_logins,
        "recent_audits": recent_audits,
        "recent_errors": recent_errors,
        "top_active_users": top_active,
        "quick_stats": {
            "active_pct": _pct(users["active"] or 0, total_users),
            "mobile_pct": _pct(users["mobile"] or 0, total_users),
            "staff_pct": _pct(users["staff"] or 0, total_users),
            "suspended_pct": _pct(users["suspended"] or 0, total_users),
        },
    }
