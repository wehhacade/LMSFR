"""Scheduled account activity checks."""

from __future__ import annotations

from celery import shared_task
from django.contrib.auth import get_user_model
from django.db.models import Max
from django.utils import timezone

from apps.accounts.services.app_activity import (
    APP_INACTIVITY_WARNING_ACTION,
    APP_WARNING_AFTER,
    mobile_login_events,
)
from apps.audit.models import AuditTrail
from apps.suspects.fcm import send_push_to_user

User = get_user_model()

WARNING_BODY = (
    "Shaqada kuma fiicnid. Waa inaad ku shaqeysaa app-ka, "
    "haddii kale adiga ayaa qaadaya mas’uuliyadda."
)


@shared_task(ignore_result=True)
def notify_inactive_app_users() -> dict:
    """Send one warning per inactivity episode after 24 hours away."""
    now = timezone.now()
    users = list(
        User.objects.filter(
            is_agent=True,
            is_active=True,
            suspend=False,
            is_superuser=False,
        ).only("id", "last_login", "date_joined")
    )
    user_ids = [user.pk for user in users]
    if not user_ids:
        return {"checked": 0, "warned": 0}

    activity_by_user = dict(
        mobile_login_events()
        .filter(user_id__in=user_ids)
        .values("user_id")
        .annotate(ts=Max("created_at"))
        .values_list("user_id", "ts")
    )
    warning_by_user = dict(
        AuditTrail.objects.filter(
            user_id__in=user_ids,
            action=APP_INACTIVITY_WARNING_ACTION,
        )
        .values("user_id")
        .annotate(ts=Max("created_at"))
        .values_list("user_id", "ts")
    )

    warned = 0
    for user in users:
        baseline = activity_by_user.get(user.pk) or user.last_login or user.date_joined
        if not baseline or now - baseline < APP_WARNING_AFTER:
            continue
        last_warning = warning_by_user.get(user.pk)
        if last_warning and last_warning >= baseline:
            continue

        sent, _failed = send_push_to_user(
            user_id=user.pk,
            title="Digniin shaqo",
            body=WARNING_BODY,
            data_type="app_activity_warning",
            data={"activity_status": "warning"},
        )
        if sent:
            AuditTrail.objects.create(
                user_id=user.pk,
                event_type=AuditTrail.EventType.OTHER,
                action=APP_INACTIVITY_WARNING_ACTION,
                submodule="Mobile Activity",
                module="amniga",
                details={"baseline": baseline.isoformat(), "sent": sent},
            )
            warned += 1

    return {"checked": len(users), "warned": warned}
