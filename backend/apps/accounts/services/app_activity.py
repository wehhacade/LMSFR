"""Shared mobile-app activity helpers for reports, warnings, and legacy APIs."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import DateTimeField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.audit.models import AuditTrail
from apps.mobile.helpers import APP_LOGIN_ACTION, format_mobile_device_label

APP_WARNING_AFTER = timedelta(days=1)
APP_INACTIVE_AFTER = timedelta(days=3)
APP_INACTIVITY_WARNING_ACTION = "App inactivity warning sent"


def mobile_login_events():
    """Audit rows that prove the mobile app was opened or authenticated.

    Covers app-open pings plus both Flutter auth paths; the web dashboard login
    writes lowercase "auth" with a different action, so it stays excluded.
    """
    return AuditTrail.objects.filter(
        Q(action__startswith=APP_LOGIN_ACTION)
        | Q(event_type=AuditTrail.EventType.LOGIN, submodule="Mobile Auth")
        | Q(event_type=AuditTrail.EventType.LOGIN, submodule="Auth", action="Login")
    )


def annotate_last_app_activity(queryset, *, user_field: str = "user_id"):
    latest = (
        mobile_login_events()
        .filter(user_id=OuterRef(user_field))
        .order_by("-created_at")
        .values("created_at")[:1]
    )
    return queryset.annotate(
        last_app_activity=Coalesce(
            Subquery(latest, output_field=DateTimeField()),
            f"{user_field.removesuffix('_id')}__last_login",
            output_field=DateTimeField(),
        )
    )


def activity_snapshot(last_activity, *, now=None) -> dict:
    now = now or timezone.now()
    if not last_activity:
        return {
            "status": "never",
            "inactive_days": None,
            "inactive_seconds": None,
        }
    if timezone.is_naive(last_activity):
        last_activity = timezone.make_aware(last_activity, timezone.get_current_timezone())
    seconds = max(0, int((now - last_activity).total_seconds()))
    if seconds < int(APP_WARNING_AFTER.total_seconds()):
        status = "active"
    elif seconds < int(APP_INACTIVE_AFTER.total_seconds()):
        status = "warning"
    else:
        status = "inactive"
    return {
        "status": status,
        "inactive_days": seconds // 86400,
        "inactive_seconds": seconds,
    }


def relative_activity_label(last_activity, *, now=None) -> str:
    if not last_activity:
        return "Weligii ma soo galin"
    now = now or timezone.now()
    if timezone.is_naive(last_activity):
        last_activity = timezone.make_aware(last_activity, timezone.get_current_timezone())
    seconds = max(0, int((now - last_activity).total_seconds()))
    if seconds < 60:
        return "Hadda"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} daqiiqo ka hor"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} saac ka hor"
    days = hours // 24
    return f"{days} maalmood ka hor"


def login_event_payload(trail: AuditTrail, user=None) -> dict:
    details = trail.details if isinstance(trail.details, dict) else {}
    device = format_mobile_device_label(
        operating_system=trail.operating_system,
        browser=trail.browser,
        network=trail.network,
        details=details,
        mobile_type=getattr(user, "mobile_type", None) if user else None,
    )
    return {
        "id": trail.pk,
        "created_at": trail.created_at.isoformat(),
        "relative": relative_activity_label(trail.created_at),
        "device": device,
        "operating_system": trail.operating_system or "",
        "ip_address": str(trail.ip_address or ""),
        "network": trail.network or "",
    }
