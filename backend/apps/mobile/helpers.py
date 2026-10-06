"""Shared helpers for Flutter /api/v3 mobile endpoints."""

from __future__ import annotations

import re
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone

from apps.audit.models import AuditTrail
from apps.audit.services.audit import AuditService
from apps.core.cache import LONG, make_cache_key
from apps.mobile.models import UserSuspectTag
from apps.suspects.photo_utils import resolve_photo_url

User = get_user_model()

APP_LOGIN_ACTION = "Waxa uu so galey appka"
MOGADISHU_TZ = ZoneInfo("Africa/Mogadishu")

_UA_JUNK = {
    "unknown",
    "null",
    "none",
    "mobile",
    "mobile-app",
    "okhttp",
    "-",
    "—",
}


def _is_device_token(value: str | None) -> bool:
    text = (value or "").strip()
    if not text:
        return False
    low = text.lower()
    if low in _UA_JUNK or low.startswith("okhttp") or "mozilla" in low or low.startswith("{wifi"):
        return False
    if low.startswith("dart/"):
        return False
    return True


def _pretty_samsung_model(code: str) -> str:
    """SM-A125F → Samsung A12; SM-S908E → Samsung S908E."""
    raw = code.strip()
    m = re.match(r"^SM-([A-Z])(\d{2,3})", raw.upper())
    if not m:
        return f"Samsung {raw}" if not raw.upper().startswith("SAMSUNG") else raw
    series, digits = m.group(1), m.group(2)
    # Marketing names use first two digits for A/M/F series (A125 → A12).
    if series in {"A", "M", "F", "J"} and len(digits) >= 2:
        return f"Samsung {series}{digits[:2]}"
    return f"Samsung {series}{digits}"


def format_mobile_device_label(
    *,
    operating_system: str | None = None,
    browser: str | None = None,
    network: str | None = None,
    details: dict | None = None,
    mobile_type: str | None = None,
) -> str:
    """
    Build a human device label like \"Android · Samsung A12\".

    Prefers model codes from network / browser / details, then OS version.
    """
    details = details or {}
    candidates = [
        details.get("model_phone"),
        network,
        browser,
        details.get("get_client_agent"),
        operating_system,
        details.get("detect_os"),
    ]
    model = ""
    android_ver = ""
    for raw in candidates:
        text = str(raw or "").strip()
        if not _is_device_token(text):
            continue
        low = text.lower()
        if low.startswith("mobile "):
            text = text[7:].strip()
            low = text.lower()
        if low.startswith("android"):
            if not android_ver:
                android_ver = text if " " in text else f"Android {text.split()[-1]}" if text.lower() != "android" else "Android"
            continue
        if re.fullmatch(r"\d{1,2}", text):
            if not android_ver:
                android_ver = f"Android {text}"
            continue
        model = text
        break

    brand = (mobile_type or "").strip()
    if brand.lower() in {"", "no phone", "null", "none"}:
        brand = ""

    if model.upper().startswith("SM-"):
        model_label = _pretty_samsung_model(model)
        brand = ""
    elif brand and model and brand.lower() not in model.lower():
        model_label = f"{brand} {model}"
        brand = ""
    elif model:
        model_label = model
    elif brand:
        model_label = brand
    else:
        model_label = ""

    platform = android_ver or (
        "iOS" if (model_label.lower().startswith("iphone") or brand.lower() == "iphone") else ("Android" if model_label else "")
    )
    if platform.lower() == "ios" and model_label.lower() == "iphone":
        return "iOS · iPhone"
    if platform and model_label:
        if model_label.lower() in platform.lower():
            return platform
        return f"{platform} · {model_label}"
    return platform or model_label or "—"


def lookup_legacy_device_meta(user_id: int) -> dict:
    """Last known phone model from legacy.audit_trails for this user."""
    from django.db import connection

    try:
        with connection.cursor() as c:
            c.execute(
                """
                SELECT operating_system, browser, network
                FROM legacy.audit_trails
                WHERE user_id::text = %s
                  AND (
                    network ~* '^(SM-|moto|itel|redmi|iphone|pixel|tecno|infinix|nokia)'
                    OR browser ILIKE 'Mobile %%'
                    OR operating_system ILIKE 'Android%%'
                    OR operating_system ~* '^SM-'
                  )
                ORDER BY date_of_event DESC NULLS LAST
                LIMIT 1
                """,
                [str(user_id)],
            )
            row = c.fetchone()
    except Exception:
        return {}
    if not row:
        return {}
    return {
        "operating_system": row[0] or "",
        "browser": row[1] or "",
        "network": row[2] or "",
    }


def user_profile_url(user, request=None) -> str | None:
    if not user.profile:
        return None
    name = getattr(user.profile, "name", "") or str(user.profile)
    if name.startswith("http"):
        return resolve_photo_url(name, request)
    return resolve_photo_url(name, request)


def user_permission_label(user) -> str:
    ut = getattr(user, "user_type", None)
    if not ut:
        return "Zerro"
    name = (ut.name or "").strip()
    lowered = name.lower()
    if lowered in ("general",):
        return "General"
    if lowered in ("degmo",):
        return "Degmo"
    if lowered in ("dev",):
        return "Dev"
    if lowered in ("baaris",):
        return "Baaris"
    if lowered in ("taliye", "taliye_degmo", "xoghaye", "taliye_qebeed"):
        return lowered
    if lowered in ("boqde", "booqde"):
        return "boqde"
    return "Agent"


def suspects_count_for_user(user_id: int) -> int:
    from apps.suspects.models import Suspect

    return Suspect.objects.filter(created_by_id=user_id).count()


def app_usage_count(user_id: int) -> int:
    return AuditTrail.objects.filter(
        user_id=user_id,
        action__startswith=APP_LOGIN_ACTION,
    ).count()


def log_app_login(request, user, *, device_meta: dict | None = None) -> None:
    """
    Record a mobile-app open / get-agent-login event.

    Legacy Flutter fields (case-insensitive aliases accepted):
      - detect_os        → e.g. \"Android 14\"
      - get_client_agent → e.g. \"Mobile SM-A525F\"
      - model_phone      → e.g. \"SM-A525F\" / \"moto g24\"
    """
    meta = device_meta or {}
    if request is not None and hasattr(request, "data"):
        # Merge body fields so callers can pass a partial device_meta.
        for key in (
            "model_phone",
            "Model_phone",
            "phone_model",
            "device_model",
            "detect_os",
            "Detect_os",
            "get_client_agent",
            "Get_client_agent",
            "ip_address",
            "Ip_address",
        ):
            if key not in meta or meta.get(key) in (None, ""):
                val = request.data.get(key)
                if val not in (None, ""):
                    meta[key] = val

    def _pick(*keys: str) -> str:
        for key in keys:
            val = meta.get(key)
            if val is None:
                continue
            text = str(val).strip()
            if text and text.lower() not in {"null", "unknown", "none"}:
                return text
        return ""

    model = _pick("model_phone", "Model_phone", "phone_model", "device_model")
    detect_os = _pick("detect_os", "Detect_os")
    client_agent = _pick("get_client_agent", "Get_client_agent")
    ip_address = _pick("ip_address", "Ip_address") or None

    # Keep legacy column semantics used by NISA app analytics.
    operating_system = detect_os or (f"Android" if model else "")
    browser = client_agent or (f"Mobile {model}" if model else "Mobile")
    # Never fall back to okhttp User-Agent as the "device" column.
    network = model or (client_agent.replace("Mobile ", "", 1).strip() if client_agent.lower().startswith("mobile ") else "") or "mobile-app"

    if model and getattr(user, "pk", None):
        brand = None
        upper = model.upper()
        if upper.startswith("SM-") or "SAMSUNG" in upper:
            brand = "Samsung"
        elif "IPHONE" in upper or upper.startswith("IPHONE"):
            brand = "Iphone"
        elif any(x in upper for x in ("REDMI", "XIAOMI", "POCO")):
            brand = "Xiaomi"
        elif "TECNO" in upper:
            brand = "Tecno"
        elif "INFINIX" in upper:
            brand = "Infinix"
        elif "ITEL" in upper:
            brand = "Itel"
        elif "MOTO" in upper:
            brand = "Motorola"
        if brand and (user.mobile_type or "").strip() in ("", "Samsung", "No Phone"):
            # Prefer a concrete brand when we can infer it from the model code.
            if brand != "Samsung" or upper.startswith("SM-"):
                user.mobile_type = brand
                try:
                    user.save(update_fields=["mobile_type"])
                except Exception:
                    logger = __import__("logging").getLogger(__name__)
                    logger.exception("Failed to update mobile_type for user %s", user.pk)

    AuditService.log(
        request=request,
        user=user,
        action=f"{APP_LOGIN_ACTION} version ---",
        submodule="Macluumaadka userska",
        event_type=AuditTrail.EventType.LOGIN,
        ip_address=ip_address,
        operating_system=operating_system or "Android",
        browser=browser,
        network=network,
        details={
            "model_phone": model,
            "detect_os": detect_os,
            "get_client_agent": client_agent,
        },
        async_write=True,
    )


def get_last_app_login(user) -> timezone.datetime | None:
    row = (
        AuditTrail.objects.filter(user_id=user.pk, action__startswith=APP_LOGIN_ACTION)
        .order_by("-created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    return row


def _to_mogadishu(dt):
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.utc)
    return dt.astimezone(MOGADISHU_TZ)


def format_user_lastlogin(dt) -> str:
    if not dt:
        return "Weligii ma soo galin"
    return _to_mogadishu(dt).strftime("%Y-%m-%d %H:%M")


def serialize_last_login_at(dt) -> str | None:
    if not dt:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.utc)
    return dt.isoformat()


def suspect_seen_by_user(user_id: int, suspect_id: int, tag_map: dict | None = None) -> bool:
    if tag_map is not None:
        return tag_map.get(suspect_id, "new") == "old"
    tag = (
        UserSuspectTag.objects.filter(user_id=user_id, suspect_id=suspect_id)
        .values_list("tag", flat=True)
        .first()
    )
    return tag == "old"


def build_tag_map(user_id: int, suspect_ids: list[int]) -> dict[int, str]:
    if not suspect_ids:
        return {}
    rows = UserSuspectTag.objects.filter(user_id=user_id, suspect_id__in=suspect_ids).values_list(
        "suspect_id", "tag"
    )
    return dict(rows)


def get_modified_dates(created_at) -> str:
    if not created_at:
        return ""
    now = timezone.now()
    if timezone.is_naive(created_at):
        created_at = timezone.make_aware(created_at, timezone.get_current_timezone())
    delta: timedelta = now - created_at
    seconds = int(delta.total_seconds())
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, _ = divmod(rem, 60)
    if days > 0:
        return f"{days} {'day' if days == 1 else 'maalin '} ka hor"
    if hours > 0:
        return f"{hours} {'hour' if hours == 1 else 'saacad '} ka hor"
    if minutes > 0:
        return f"{minutes} daqiiqo ka hor"
    return "Hadda"


def cached_car_modals():
    key = make_cache_key("mobile", "car_modals")
    data = cache.get(key)
    if data is not None:
        return data
    from apps.mobile.models import SuspectCarModal

    data = list(SuspectCarModal.objects.order_by("name").values("id", "name"))
    cache.set(key, data, LONG)
    return data


def cached_documents_by_tag(tag: str):
    key = make_cache_key("mobile", "documents", tag)
    data = cache.get(key)
    if data is not None:
        return data
    from apps.mobile.models import AppDocument

    data = list(
        AppDocument.objects.filter(tag=tag).values("id", "tobic", "body", "tag")
    )
    cache.set(key, data, LONG)
    return data


def is_clear(value) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    return False


def legacy_success(message):
    return {"isError": False, "title": "Success", "type": "success", "Message": message}
