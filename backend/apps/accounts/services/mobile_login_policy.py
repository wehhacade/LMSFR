"""Who may obtain JWTs from web vs mobile login endpoints."""

from __future__ import annotations

SURVEY_MOBILE_USER_TYPE = "survey-mobile"
MOBILE_LOGIN_REQUIRED_DETAIL = "Use the mobile app to sign in."

# Legacy/mobile-only login routes (not the web dashboard form).
_MOBILE_LOGIN_PATH_MARKERS = (
    "/mobile/login/",
    "/surveys-login",
    "/hubkadhigis-login",
    "/dhacdooyinka-login",
)


def is_survey_mobile_user(user) -> bool:
    """survey-mobile user type, or is_mobile when type is not set."""
    if not user or not getattr(user, "is_active", False):
        return False
    ut = getattr(user, "user_type", None)
    if ut is not None and (getattr(ut, "name", "") or "").strip().lower() == SURVEY_MOBILE_USER_TYPE:
        return True
    return bool(getattr(user, "is_mobile", False))


def is_survey_only_field_user(user) -> bool:
    """
    Field users who must not receive JWTs from the web login form.
    Agents, staff, and admins may still use the dashboard even when is_mobile.
    """
    if not is_survey_mobile_user(user):
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return False
    if getattr(user, "is_admin", False) or getattr(user, "is_officer", False):
        return False
    if getattr(user, "is_agent", False):
        return False
    return True


def is_mobile_client_request(request) -> bool:
    """True when the client identifies as a mobile app (header, body, or mobile login URL)."""
    if request is None:
        return False

    path = (getattr(request, "path", "") or "").lower()
    if any(marker in path for marker in _MOBILE_LOGIN_PATH_MARKERS):
        return True
    # Legacy Flutter /login/ at API root — not /auth/login/.
    if path.rstrip("/").endswith("/login") and "/auth/login" not in path:
        return True

    for header in ("HTTP_X_CLIENT", "HTTP_X_APP_CLIENT"):
        value = (request.META.get(header) or "").strip().lower()
        if value in {"mobile", "app", "1", "true", "yes"}:
            return True

    body = getattr(request, "data", None)
    if hasattr(body, "get"):
        client = body.get("client")
        if str(client or "").strip().lower() == "mobile":
            return True

    query = getattr(request, "query_params", None)
    if query is not None and str(query.get("client") or "").strip().lower() == "mobile":
        return True

    return False


def web_login_allowed(user, *, mobile_client: bool) -> bool:
    if not is_survey_only_field_user(user):
        return True
    return mobile_client


def assert_web_login_allowed(user, *, mobile_client: bool) -> None:
    if not web_login_allowed(user, mobile_client=mobile_client):
        raise ValueError(MOBILE_LOGIN_REQUIRED_DETAIL)
