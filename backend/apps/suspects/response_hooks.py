"""Auto SuspectResponse + hooks after suspect registration."""

from __future__ import annotations

import logging
import threading

from django.utils import timezone

from apps.suspects.models import Suspect, SuspectResponse
from apps.suspects.tasks import push_new_suspect_async

logger = logging.getLogger(__name__)


def auto_create_suspect_response(suspect: Suspect, user) -> SuspectResponse:
    today = timezone.now().date()
    details = suspect.notes or suspect.offense or "—"
    return SuspectResponse.objects.create(
        suspect=suspect,
        user=user,
        details=details,
        date_opp=today,
    )


def _broadcast_new_suspect_background(suspect_name: str, exclude_user_id: str | None) -> None:
    """Last-resort FCM fan-out off the request/gunicorn worker thread."""
    try:
        from apps.suspects.fcm import broadcast_push

        broadcast_push(
            exclude_user_id=exclude_user_id,
            title="App-ka C.I.SH",
            body=(
                f"🔔Tuhunsane: ( {suspect_name}) Ayaa La Liwaangeliyay, "
                "Hadaad Xog Ka Hayso So Sheeg fadlan."
            ),
            data_type="response",
        )
    except Exception:
        logger.exception(
            "Background FCM broadcast failed for new suspect name=%s",
            suspect_name,
        )


def notify_new_suspect(suspect: Suspect, registering_user) -> None:
    """
    Enqueue FCM via Celery. Never block the HTTP request with broadcast_push.
    If enqueue fails, fall back to a daemon thread (still async to the client).
    """
    exclude_id = str(registering_user.pk) if registering_user is not None else None
    name = suspect.name or ""
    try:
        push_new_suspect_async.delay(name, exclude_id)
        return
    except Exception:
        logger.exception(
            "Celery enqueue failed for push_new_suspect_async; using background thread"
        )

    threading.Thread(
        target=_broadcast_new_suspect_background,
        args=(name, exclude_id),
        name="fcm-new-suspect",
        daemon=True,
    ).start()


def after_suspect_registered(suspect: Suspect, user) -> SuspectResponse:
    response = auto_create_suspect_response(suspect, user)
    try:
        notify_new_suspect(suspect, user)
    except Exception:
        # Registration must succeed even if push wiring blows up.
        logger.exception(
            "notify_new_suspect failed after register suspect_id=%s",
            getattr(suspect, "pk", None),
        )
    return response
