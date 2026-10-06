"""Profile, auth aliases, and location endpoints for Flutter."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.accounts.services.auth_service import AuthService
from apps.audit.models import AuditTrail
from apps.audit.services.audit import AuditService
from apps.legacy_api.helpers import legacy_catch, legacy_ok, legacy_validation
from apps.mobile.helpers import (
    app_usage_count,
    format_user_lastlogin,
    get_last_app_login,
    serialize_last_login_at,
    log_app_login,
    suspects_count_for_user,
    user_permission_label,
    user_profile_url,
)
from apps.mobile.models import UserLocation

User = get_user_model()


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def user_profile(request):
    user = request.user
    suspects_count = suspects_count_for_user(user.pk)
    profile = user_profile_url(user, request)
    return Response(
        {
            "id": user.id,
            "profile": profile or "",
            "phone": user.phone or "",
            "date_joined": user.date_joined.strftime("%Y-%m-%d"),
            "bio": suspects_count,
            "email": user.email,
            "first_name": f"{user.first_name} {user.last_name}".strip(),
            "Permission": user_permission_label(user),
            "county_id": user.county_id,
        }
    )


def _agent_payload(user, request, *, log_visit: bool = False) -> dict:
    lock_until = user.lock_until
    if lock_until:
        if timezone.is_naive(lock_until):
            lock_until = timezone.make_aware(lock_until, timezone.get_current_timezone())
        lock_until = timezone.localtime(lock_until).isoformat()

    payload = {
        "id": user.id,
        "image": user_profile_url(user, request),
        "username": user.get_full_name(),
        "phone": user.phone or "",
        "email": user.email,
        "login_attempts": user.login_attempts or 0,
        "log_until": lock_until,
        "user_suspect": suspects_count_for_user(user.pk),
        "date_joined": user.date_joined.strftime("%Y-%m-%d"),
        "app_usage": app_usage_count(user.pk),
        "Permission": user_permission_label(user),
        "county_id": user.county_id,
        "change_password": user.password_changed,
        "change_app_pin": user.app_pin_changed,
    }
    if log_visit:
        log_app_login(
            request,
            user,
            device_meta={
                "model_phone": request.data.get("model_phone"),
                "ip_address": request.data.get("ip_address"),
                "detect_os": request.data.get("detect_os"),
                "get_client_agent": request.data.get("get_client_agent"),
            },
        )
    return payload


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def get_agent_login(request):
    user_id = request.data.get("user_id")
    if not user_id:
        return legacy_validation("user_id is missing")
    try:
        user = User.objects.select_related("user_type", "county").get(pk=int(user_id))
    except (User.DoesNotExist, ValueError, TypeError):
        return legacy_validation("User not found")
    return legacy_ok(_agent_payload(user, request, log_visit=True))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def get_agent_data(request):
    user_id = request.data.get("user_id")
    if not user_id:
        return legacy_validation("user_id is required")
    user = User.objects.select_related("user_type", "county").get(pk=int(user_id))
    last_app_login = get_last_app_login(user)
    message = {
        "id": user.id,
        "image": user_profile_url(user, request),
        "username": user.get_full_name(),
        "phone": user.phone or "",
        "email": user.email,
        "gender": user.gender or "",
        "degmo": user.county.name if user.county else None,
        "user_suspect": suspects_count_for_user(user.pk),
        "date_joined": user.date_joined.strftime("%Y-%m-%d"),
        "app_usage": app_usage_count(user.pk),
        "is_active": user.is_active,
        "have_perm": request.user.is_superuser,
        "lastlogin": format_user_lastlogin(last_app_login),
        "last_login_at": serialize_last_login_at(last_app_login),
    }
    return legacy_ok(message)


def _save_location_row(user, latitude, longitude):
    from datetime import datetime

    if latitude is None and longitude is None:
        return
    today = datetime.today()
    UserLocation.objects.create(
        user=user,
        latitude=latitude,
        longitude=longitude,
        reg_day=today.strftime("%Y-%m-%d"),
        month=today.strftime("%m"),
        year=today.strftime("%Y"),
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def update_user_location_attempts(request):
    user_id = request.data.get("user_id")
    latitude = request.data.get("latitude")
    longitude = request.data.get("longitude")
    is_successful = request.data.get("is_successful")

    try:
        user = User.objects.get(pk=int(user_id))
    except (User.DoesNotExist, ValueError, TypeError):
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    now = timezone.now()
    if user.lock_until and now < user.lock_until:
        return Response({"error": "User is locked out. Try again later."}, status=status.HTTP_403_FORBIDDEN)

    if is_successful:
        user.login_attempts = 0
        user.lock_until = None
    else:
        user.login_attempts = (user.login_attempts or 0) + 1
        if user.login_attempts >= 3:
            user.lock_until = now + timedelta(minutes=1)

    user.latitude = str(latitude) if latitude is not None else user.latitude
    user.longitude = str(longitude) if longitude is not None else user.longitude
    user.last_login_device = request.META.get("HTTP_USER_AGENT", "Unknown Device")
    _save_location_row(user, latitude, longitude)
    user.save(
        update_fields=[
            "login_attempts",
            "lock_until",
            "latitude",
            "longitude",
            "last_login_device",
        ]
    )
    return Response({"message": "User location and login attempts updated successfully."})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def save_user_location(request):
    user_id = request.data.get("user_id")
    latitude = request.data.get("latitude")
    longitude = request.data.get("longitude")
    try:
        user = User.objects.get(pk=int(user_id))
    except (User.DoesNotExist, ValueError, TypeError):
        return Response({"success": False, "message": "User-ka lama helin."}, status=404)
    _save_location_row(user, latitude, longitude)
    # Keep denormalized coords on User for distance sorting / maps.
    if latitude is not None:
        user.latitude = str(latitude)
    if longitude is not None:
        user.longitude = str(longitude)
    if latitude is not None or longitude is not None:
        user.save(update_fields=["latitude", "longitude"])
    return Response({"success": True, "message": "Goobta user-ka waa la kaydiyey."})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def update_profile(request):
    user_id = request.data.get("user_id")
    if str(request.user.pk) != str(user_id) and not request.user.is_superuser:
        return Response({"error": "Permission denied"}, status=403)

    user = User.objects.select_related("county").get(pk=int(user_id))
    updated = []
    for field, attr in (
        ("first_name", "first_name"),
        ("last_name", "last_name"),
        ("email", "email"),
        ("phone", "phone"),
        ("gender", "gender"),
    ):
        val = request.data.get(field)
        if val is not None and str(val).strip():
            setattr(user, attr, val)
            updated.append(attr)

    degmo = request.data.get("degmo")
    if degmo is not None and str(degmo).strip():
        user.county_id = int(degmo)
        updated.append("county_id")

    if updated:
        user.save(update_fields=updated)
    return Response({"message": f"{user.get_full_name()}'s profile successfully updated"})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def change_password_legacy(request):
    user = request.user
    old_password = request.data.get("old_password")
    new_password = request.data.get("new_password")

    if not check_password(old_password or "", user.password):
        return Response({"old_password": ["Wrong password."]}, status=400)
    if not new_password or len(new_password) < 6:
        return Response(
            {"new_password": ["Password must be at least 6 characters long."]},
            status=400,
        )

    AuthService.change_password(user, old_password, new_password)
    AuditService.log(
        request=request,
        user=user,
        action="Waxa uu Badalay Passworkiisa",
        submodule="Macluumaadka userska",
        event_type=AuditTrail.EventType.UPDATE,
        ip_address=request.data.get("ip_address"),
        operating_system=request.data.get("detect_os"),
        browser=request.data.get("get_client_agent"),
        network=request.data.get("model_phone"),
        async_write=True,
    )
    return Response({"status": "paswsord set"})
