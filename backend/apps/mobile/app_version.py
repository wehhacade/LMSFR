"""Public app-version payload and the phone version gate.

The JSON shape of this payload is part of the contract with already-installed
apps. Add fields only if an old app can ignore them; do not rename or remove
min_version_code, latest_version_code, apk_url, or message.
"""

from __future__ import annotations

import logging

from django.core.cache import cache
from django.http import JsonResponse

from apps.mobile.models import AppVersionPolicy

logger = logging.getLogger(__name__)

CACHE_KEY = "mobile:app-version-policy"
CACHE_SECONDS = 15

WEB_CLIENT_HEADER = "X-LMSBR-Client"
WEB_CLIENT_VALUE = "web"
APP_VERSION_HEADER = "X-App-Version-Code"

# Paths that must answer even when the calling app is too old.
# Health and the API root are for deploy checks, not the phone.
EXEMPT_PATHS = frozenset(
    {
        "/api/v2",
        "/api/v3",
        "/api/v2/app-version",
        "/api/v3/app-version",
        "/api/v2/app-releases",
        "/api/v3/app-releases",
        "/api/v2/health",
        "/api/v3/health",
    }
)


def parse_version_code(raw: str | None) -> int:
    """Android versionCode. Missing or junk counts as 0, which is below any raised minimum."""
    text = (raw or "").strip()
    if not text.isdigit():
        return 0
    return int(text)


def split_version_code(code: int) -> tuple[int, int, int]:
    """3 stays 3.0.0. 30100 is 3.1.0. 30102 is 3.1.2."""
    code = int(code or 0)
    if code >= 10000:
        major, rest = divmod(code, 10000)
        minor, patch = divmod(rest, 100)
        return major, minor, patch
    if code >= 100:
        major, minor = divmod(code, 100)
        return major, minor, 0
    return code, 0, 0


def compose_version_code(major: int, minor: int, patch: int = 0) -> int:
    """Turn major.minor.patch into the integer the phone sends.

    3.0.0 stays 3 so the current gate does not move. 3.1.2 becomes 30102.
    The dashboard may set any version, including a lower one.
    """
    if minor > 99 or patch > 99:
        raise ValueError("minor and patch must be from 0 to 99.")
    if major > 9999:
        raise ValueError("major is too large.")
    if minor == 0 and patch == 0 and major < 100:
        return major
    return major * 10000 + minor * 100 + patch


def policy_payload(policy: AppVersionPolicy) -> dict:
    return {
        "min_version_code": int(policy.min_version_code),
        "latest_version_code": int(policy.latest_version_code),
        "apk_url": policy.apk_url,
        "message": policy.message,
    }


def get_policy_payload() -> dict | None:
    """Return the public record, or None when it cannot be read (fail open)."""
    cached = cache.get(CACHE_KEY)
    if isinstance(cached, dict) and cached.get("min_version_code") is not None:
        return cached
    if cached == {}:
        return None

    try:
        policy = AppVersionPolicy.objects.filter(pk=1).first()
    except Exception:
        logger.exception("App version policy could not be read")
        return None

    if policy is None:
        cache.set(CACHE_KEY, {}, CACHE_SECONDS)
        return None

    payload = policy_payload(policy)
    cache.set(CACHE_KEY, payload, CACHE_SECONDS)
    return payload


def is_web_client(request) -> bool:
    return (request.headers.get(WEB_CLIENT_HEADER) or "").strip().lower() == WEB_CLIENT_VALUE


def request_is_exempt(request) -> bool:
    if request.method == "OPTIONS":
        return True
    path = request.path or ""
    if not path.startswith("/api/"):
        return True
    if path.rstrip("/") in EXEMPT_PATHS:
        return True
    if is_web_client(request):
        return True
    return False


def version_block_response(request) -> JsonResponse | None:
    """426 when the phone build is below the minimum. Login does not skip this."""
    if request_is_exempt(request):
        return None
    payload = get_policy_payload()
    if not payload:
        return None
    version = parse_version_code(request.headers.get(APP_VERSION_HEADER))
    if version >= int(payload["min_version_code"]):
        return None
    response = JsonResponse(payload, status=426)
    response["Cache-Control"] = "no-store"
    return response
