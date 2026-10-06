"""Access Gateway client for NIRA seeding/verification.

This keeps the Access Gateway API key server-side (mobile/web must never see it).
"""

from __future__ import annotations

import json
import socket
import ssl
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urlparse

from django.conf import settings


class AccessGatewayError(RuntimeError):
    pass


def _gateway_base_url() -> str:
    return getattr(settings, "ACCESS_GATEWAY_BASE_URL", "").rstrip("/")


def _gateway_api_key() -> str:
    return getattr(settings, "ACCESS_GATEWAY_API_KEY", "").strip()


def _gateway_project_slug() -> str:
    return getattr(settings, "ACCESS_GATEWAY_PROJECT_SLUG", "hubiye-api").strip()


def _timeout_seconds() -> int:
    return int(getattr(settings, "ACCESS_GATEWAY_TIMEOUT_SECONDS", 15))


def _gateway_host_header(base_url: str) -> str | None:
    """Host header required by AccessHub when reached via public NAT IP.

    Public front (e.g. 102.68.151.91) forwards to private gateway (10.0.20.44).
    Without Host=10.0.20.44 Django on the gateway returns HTTP 400.
    """
    configured = (getattr(settings, "ACCESS_GATEWAY_HOST_HEADER", "") or "").strip()
    if configured:
        return configured
    host = (urlparse(base_url).hostname or "").strip()
    # Default: public LMSBR NAT → private AccessHub host
    if host in {"102.68.151.91", "102.68.151.90"}:
        return "10.0.20.44"
    return None


def _ssl_context() -> ssl.SSLContext:
    # AccessHub presents a self-signed cert (CN=10.0.20.44).
    return ssl._create_unverified_context()


def _request_json(method: str, path: str, *, body: dict[str, Any] | None = None) -> Any:
    base = _gateway_base_url()
    api_key = _gateway_api_key()
    if not base:
        raise AccessGatewayError("ACCESS_GATEWAY_BASE_URL is not configured.")
    if not api_key:
        raise AccessGatewayError("ACCESS_GATEWAY_API_KEY is not configured.")

    url = f"{base}{path}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    host_header = _gateway_host_header(base)
    if host_header:
        headers["Host"] = host_header

    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url=url, method=method.upper(), headers=headers, data=data)

    try:
        with urllib.request.urlopen(req, timeout=_timeout_seconds(), context=_ssl_context()) as resp:
            raw = resp.read()
            if not raw:
                return {}
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            raw = e.read()
            detail = raw.decode("utf-8", errors="ignore")
        except Exception:
            detail = str(e)
        raise AccessGatewayError(f"Gateway HTTP {e.code}: {detail}") from e
    except (urllib.error.URLError, socket.timeout) as e:
        raise AccessGatewayError(f"Gateway network error: {e}") from e


def get_seeding_reasons() -> Any:
    """GET /gateway/{project}/seeding/reasons"""
    slug = _gateway_project_slug()
    return _request_json("GET", f"/gateway/{slug}/seeding/reasons")


def initiate_seeding_otp(*, id_number: str, seeding_reason_code: str) -> Any:
    """POST /gateway/{project}/seeding/otp"""
    slug = _gateway_project_slug()
    return _request_json(
        "POST",
        f"/gateway/{slug}/seeding/otp",
        body={"idNumber": id_number, "seedingReasonCode": seeding_reason_code},
    )


def get_otp_profile(*, otp_code: str, id_number: str, otp_consent_id: str, credential_type: str = "CERTIFICATE") -> Any:
    """POST /gateway/{project}/seeding/otp/profile"""
    slug = _gateway_project_slug()
    return _request_json(
        "POST",
        f"/gateway/{slug}/seeding/otp/profile",
        body={
            "otpCode": otp_code,
            "idNumber": id_number,
            "otpConsentId": otp_consent_id,
            "credentialType": credential_type,
        },
    )
