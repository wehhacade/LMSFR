from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsActiveUser, IsAdminUser
from apps.mobile.app_version import (
    CACHE_KEY,
    CACHE_SECONDS,
    compose_version_code,
    get_policy_payload,
    policy_payload,
    split_version_code,
)
from apps.mobile.models import AppVersionPolicy, AppVersionRelease

_url_validator = URLValidator(schemes=["http", "https"])


def _version_code(value, field: str) -> int:
    try:
        code = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a whole number.")
    if code < 0:
        raise ValueError(f"{field} cannot be negative.")
    return code


@method_decorator(never_cache, name="dispatch")
class AppVersionView(APIView):
    """GET is public. PATCH is for dashboard admins."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsActiveUser(), IsAdminUser()]

    def get(self, request):
        payload = get_policy_payload()
        if payload is None:
            policy, _created = AppVersionPolicy.objects.get_or_create(pk=1)
            payload = policy_payload(policy)
            cache.set(CACHE_KEY, payload, CACHE_SECONDS)
        return Response(payload)

    def patch(self, request):
        policy, _created = AppVersionPolicy.objects.get_or_create(pk=1)
        data = request.data if isinstance(request.data, dict) else {}
        errors = {}

        if "min_major" in data or "min_minor" in data or "min_patch" in data:
            try:
                major = _version_code(data.get("min_major", policy.min_major), "min_major")
                minor = _version_code(data.get("min_minor", policy.min_minor), "min_minor")
                patch = _version_code(data.get("min_patch", policy.min_patch), "min_patch")
                policy.min_major = major
                policy.min_minor = minor
                policy.min_patch = patch
                policy.min_version_code = compose_version_code(major, minor, patch)
            except ValueError as exc:
                errors["min_version_code"] = str(exc)
        elif "min_version_code" in data:
            try:
                policy.min_version_code = _version_code(data.get("min_version_code"), "min_version_code")
                policy.min_major, policy.min_minor, policy.min_patch = split_version_code(policy.min_version_code)
            except ValueError as exc:
                errors["min_version_code"] = str(exc)
        if "latest_major" in data or "latest_minor" in data or "latest_patch" in data:
            try:
                major = _version_code(data.get("latest_major", policy.latest_major), "latest_major")
                minor = _version_code(data.get("latest_minor", policy.latest_minor), "latest_minor")
                patch = _version_code(data.get("latest_patch", policy.latest_patch), "latest_patch")
                policy.latest_version_code = compose_version_code(major, minor, patch)
                policy.latest_major = major
                policy.latest_minor = minor
                policy.latest_patch = patch
            except ValueError as exc:
                errors["latest_version_code"] = str(exc)
        elif "latest_version_code" in data:
            try:
                code = _version_code(data.get("latest_version_code"), "latest_version_code")
                policy.latest_version_code = code
                policy.latest_major, policy.latest_minor, policy.latest_patch = split_version_code(code)
            except ValueError as exc:
                errors["latest_version_code"] = str(exc)
        if "apk_url" in data:
            apk_url = str(data.get("apk_url") or "").strip()
            try:
                _url_validator(apk_url)
            except ValidationError:
                errors["apk_url"] = "apk_url must be an http or https address."
            else:
                policy.apk_url = apk_url
        if "message" in data:
            message = str(data.get("message") or "").strip()
            if not message:
                errors["message"] = "message is required."
            elif len(message) > 255:
                errors["message"] = "message is too long."
            else:
                policy.message = message

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        policy.save()
        _remember_release(policy)
        payload = policy_payload(policy)
        cache.set(CACHE_KEY, payload, CACHE_SECONDS)
        return Response(_admin_payload(policy))


def _admin_payload(policy: AppVersionPolicy) -> dict:
    payload = policy_payload(policy)
    payload.update(
        {
            "min_major": int(policy.min_major),
            "min_minor": int(policy.min_minor),
            "min_patch": int(policy.min_patch),
            "latest_major": int(policy.latest_major),
            "latest_minor": int(policy.latest_minor),
            "latest_patch": int(policy.latest_patch),
        }
    )
    return payload


def _remember_release(policy: AppVersionPolicy) -> None:
    latest = AppVersionRelease.objects.order_by("-id").first()
    snapshot = (
        policy.latest_version_code,
        policy.latest_major,
        policy.latest_minor,
        policy.latest_patch,
        policy.min_version_code,
        policy.min_major,
        policy.min_minor,
        policy.min_patch,
        policy.apk_url,
        policy.message,
    )
    if latest is not None and (
        latest.version_code,
        latest.version_major,
        latest.version_minor,
        latest.version_patch,
        latest.min_version_code,
        latest.min_major,
        latest.min_minor,
        latest.min_patch,
        latest.apk_url,
        latest.message,
    ) == snapshot:
        return
    AppVersionRelease.objects.create(
        version_code=policy.latest_version_code,
        version_major=policy.latest_major,
        version_minor=policy.latest_minor,
        version_patch=policy.latest_patch,
        min_version_code=policy.min_version_code,
        min_major=policy.min_major,
        min_minor=policy.min_minor,
        min_patch=policy.min_patch,
        apk_url=policy.apk_url,
        message=policy.message,
    )


def release_rows():
    return [
        {
            "id": row.id,
            "version_code": row.version_code,
            "version_major": row.version_major,
            "version_minor": row.version_minor,
            "version_patch": row.version_patch,
            "min_version_code": row.min_version_code,
            "min_major": row.min_major,
            "min_minor": row.min_minor,
            "min_patch": row.min_patch,
            "apk_url": row.apk_url,
            "message": row.message,
            "created_at": row.created_at.isoformat(),
        }
        for row in AppVersionRelease.objects.all()[:100]
    ]


class AppVersionReleaseListView(APIView):
    """Saved releases for the dashboard. Phones keep using GET /app-version."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsAdminUser]

    def get(self, request):
        policy, _created = AppVersionPolicy.objects.get_or_create(pk=1)
        return Response({"current": _admin_payload(policy), "releases": release_rows()})


class AppVersionReleaseDetailView(APIView):
    """Remove one saved release. The live current version stays."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsAdminUser]

    def delete(self, request, pk):
        release = AppVersionRelease.objects.filter(pk=pk).first()
        if release is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        policy = AppVersionPolicy.objects.filter(pk=1).first()
        if policy is not None and release.version_code == policy.latest_version_code:
            return Response(
                {"detail": "The current version cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        release.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
