"""Firebase Cloud Messaging — lazy init, batch-friendly helpers."""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

# Mobile apps share one token table but must not receive each other's pushes.
APP_ILAALO = "ilaalo"
APP_SURVEY = "survey"

_firebase_ready = False
_firebase_lock = threading.Lock()


def _ensure_firebase() -> bool:
    global _firebase_ready
    if _firebase_ready:
        return True
    with _firebase_lock:
        if _firebase_ready:
            return True
        cred_path = Path(settings.FIREBASE_CREDENTIALS_PATH)
        if not cred_path.is_file():
            logger.warning("Firebase credentials not found at %s — push disabled", cred_path)
            return False
        try:
            import firebase_admin
            from firebase_admin import credentials

            if not firebase_admin._apps:
                cred = credentials.Certificate(str(cred_path))
                firebase_admin.initialize_app(cred)
            _firebase_ready = True
            return True
        except Exception as exc:
            logger.exception("Firebase init failed: %s", exc)
            return False


def _stringify_data(data: dict[str, Any] | None) -> dict[str, str]:
    """FCM data payload values must be strings."""
    out: dict[str, str] = {}
    if not data:
        return out
    for key, value in data.items():
        if value is None:
            continue
        out[str(key)] = value if isinstance(value, str) else str(value)
    return out


def send_push_to_token(
    *,
    token: str,
    title: str,
    body: str,
    data_type: str = "ogeysiis",
    data: dict[str, Any] | None = None,
    silent: bool = False,
) -> bool:
    if not _ensure_firebase():
        return False
    from firebase_admin import messaging

    payload = {"type": data_type, **(data or {})}
    # Walkie invites / county broadcast: data-only + high priority so Android
    # delivers to FirebaseMessagingService while backgrounded/killed. A visible
    # `notification` payload would only show a tray item and require a tap.
    is_ptt_data_only = data_type in (
        "ptt_invite",
        "ptt_broadcast",
        "ptt_broadcast_end",
    )
    # PTT uses a dedicated channel; notices/general use default so Android
    # still shows the tray item when the app has no custom channel registered.
    channel_id = "ptt_invite_channel" if data_type.startswith("ptt_") else None
    message_kwargs: dict[str, Any] = {
        "token": token,
        "data": _stringify_data(
            {
                **payload,
                # Keep title/body in data for native heads-up / full-screen UI.
                "title": title,
                "body": body,
            }
        ),
        "android": messaging.AndroidConfig(priority="high"),
    }
    if not silent and not is_ptt_data_only:
        android_notification_kwargs: dict[str, Any] = {
            "sound": "default",
            "priority": "max",
            "default_vibrate_timings": True,
        }
        if channel_id:
            android_notification_kwargs["channel_id"] = channel_id
        message_kwargs["notification"] = messaging.Notification(title=title, body=body)
        message_kwargs["android"] = messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(**android_notification_kwargs),
        )

    try:
        messaging.send(messaging.Message(**message_kwargs))
        logger.info(
            "FCM sent to %s… type=%s channel=%s data_only=%s",
            token[:24],
            data_type,
            channel_id,
            is_ptt_data_only or silent,
        )
        return True
    except messaging.UnregisteredError:
        from apps.suspects.models import FCMToken

        FCMToken.objects.filter(fcm_token=token).delete()
        return False
    except Exception as exc:
        logger.warning("FCM send failed: %s", exc)
        return False


def send_push_to_user(
    *,
    user_id: int,
    title: str,
    body: str,
    data_type: str = "ogeysiis",
    data: dict[str, Any] | None = None,
    silent: bool = False,
    app_slug: str = APP_ILAALO,
) -> tuple[int, int]:
    """Send to FCM tokens for a user in one mobile app. Returns (sent, failed)."""
    from apps.suspects.models import FCMToken

    qs = FCMToken.objects.filter(user_id=user_id, app_slug=app_slug).only("fcm_token")
    sent = failed = 0
    for row in qs.iterator(chunk_size=50):
        ok = send_push_to_token(
            token=row.fcm_token,
            title=title,
            body=body,
            data_type=data_type,
            data=data,
            silent=silent,
        )
        if ok:
            sent += 1
        else:
            failed += 1
    if sent == 0 and failed == 0:
        logger.info("No FCM tokens for user_id=%s", user_id)
    return sent, failed


def broadcast_push(
    *,
    exclude_user_id=None,
    title: str,
    body: str,
    data_type: str = "response",
    app_slug: str = APP_ILAALO,
) -> tuple[int, int]:
    """Send to all tokens for one mobile app except exclude_user_id. Returns (sent, failed)."""
    from apps.suspects.models import FCMToken

    qs = FCMToken.objects.filter(app_slug=app_slug).select_related("user").only("id", "fcm_token", "user_id")
    if exclude_user_id:
        qs = qs.exclude(user_id=exclude_user_id)

    sent = failed = 0
    for row in qs.iterator(chunk_size=200):
        if send_push_to_token(token=row.fcm_token, title=title, body=body, data_type=data_type):
            sent += 1
        else:
            failed += 1
    return sent, failed
