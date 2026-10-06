"""Mobile JWT login + app PIN — legacy /api/v3/mobile/login/, set-pin, verify-pin."""

from __future__ import annotations

import logging
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import update_last_login
from django.contrib.auth.hashers import check_password, make_password
from rest_framework import status
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.audit.models import AuditTrail
from apps.audit.services.audit import AuditService

User = get_user_model()

logger = logging.getLogger(__name__)

# Legacy Flutter builds send varying cases/aliases for the credential fields.
_IDENTIFIER_KEYS = frozenset(
    {"email", "e_mail", "emailaddress", "email_address", "username", "user_name", "user", "login", "userid", "user_id"}
)
_PASSWORD_KEYS = frozenset({"password", "pass", "passwd", "pwd", "user_password", "userpassword"})


def normalize_legacy_login_payload(data):
    """Map legacy mobile credential keys (any case/alias) to DRF/JWT field names."""
    if hasattr(data, "dict"):
        items = data.dict().items()
    elif isinstance(data, dict):
        items = data.items()
    else:
        items = dict(data).items()

    normalized = {}
    for key, value in items:
        canonical = str(key).strip().lower().replace("-", "_")
        if canonical in _IDENTIFIER_KEYS:
            target = "email"
        elif canonical in _PASSWORD_KEYS:
            target = "password"
        else:
            target = key
        if not normalized.get(target):
            normalized[target] = value
    return normalized


def _resolve_login_user(identifier: str):
    if not identifier:
        return None
    identifier = identifier.strip()
    qs = User.objects.select_related("user_type", "county")
    # Field agents sign in with the final four digits of their employee number
    # (Agent.nickname). service_id is a short internal code and must not match
    # here — otherwise login 1563 collides with an unrelated agent's service_id.
    # Duplicate nicknames fail closed rather than signing in the wrong agent.
    if len(identifier) == 4 and identifier.isdigit():
        matches = list(
            qs.filter(agent_profile__nickname__endswith=identifier).order_by("pk")[:2]
        )
        return matches[0] if len(matches) == 1 else None
    if "@" in identifier:
        return qs.filter(email__iexact=identifier).first()
    user = qs.filter(username__iexact=identifier).first()
    if user:
        return user
    return qs.filter(email__iexact=identifier).first()


def _legacy_login_role_fields(user) -> dict:
    from apps.mobile.helpers import user_permission_label

    ut = getattr(user, "user_type", None)
    type_name = (getattr(ut, "name", None) or "").strip() or None
    return {
        "Permission": user_permission_label(user),
        "user_type_name": type_name,
        "county_id": getattr(user, "county_id", None),
    }


class MobileTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Email or username + password; extended JWT lifetimes; mobile/agent gate."""

    username = serializers.CharField(required=False, write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False

    def validate(self, attrs):
        identifier = (
            attrs.pop("username", None)
            or attrs.get(self.username_field)
            or attrs.get("email")
        )
        password = attrs.get("password")
        user = _resolve_login_user(identifier or "")
        if not user:
            raise AuthenticationFailed("No active account found with the given credentials")

        authed = authenticate(
            request=self.context.get("request"),
            username=user.email,
            password=password,
        )
        if not authed:
            raise AuthenticationFailed("No active account found with the given credentials")

        if not authed.is_active or getattr(authed, "suspend", False):
            raise AuthenticationFailed("Account is inactive or suspended")

        if not (authed.is_superuser or authed.is_agent or authed.is_mobile):
            raise AuthenticationFailed("Account is not authorized for mobile access")

        self.user = authed
        update_last_login(None, authed)
        refresh = self.get_token(self.user)
        refresh.set_exp(lifetime=timedelta(days=90))
        access = refresh.access_token
        access.set_exp(lifetime=timedelta(days=60))

        AuditService.log(
            request=self.context.get("request"),
            user=authed,
            action="Mobile login",
            submodule="Mobile Auth",
            event_type=AuditTrail.EventType.LOGIN,
            async_write=True,
        )

        return {
            "refresh": str(refresh),
            "access": str(access),
            "user_id": str(authed.pk),
            "email": authed.email,
            "username": authed.username,
            **_legacy_login_role_fields(authed),
        }


class LegacyLoginPayloadMixin:
    """Accept legacy credential field names/cases from older Flutter mobile apps."""

    def _normalize(self, data):
        normalized = normalize_legacy_login_payload(data)
        if not normalized.get("email") or not normalized.get("password"):
            # Field names only — never values — so an unrecognised client can be diagnosed.
            logger.warning(
                "Login payload missing credentials on %s: keys=%s content_type=%s",
                getattr(self.request, "path", "?"),
                sorted(str(k) for k in (data.keys() if hasattr(data, "keys") else [])),
                getattr(self.request, "content_type", "?"),
            )
        return normalized

    def get_serializer(self, *args, **kwargs):
        if kwargs.get("data") is not None:
            kwargs["data"] = self._normalize(kwargs["data"])
        elif args:
            args = (self._normalize(args[0]), *args[1:])
        return super().get_serializer(*args, **kwargs)


class MobileTokenObtainPairView(LegacyLoginPayloadMixin, TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = MobileTokenObtainPairSerializer


class LegacyEmailTokenObtainPairSerializer(MobileTokenObtainPairSerializer):
    """Flutter /login/ — email+password, no mobile-only gate, extended JWT."""

    def validate(self, attrs):
        identifier = (
            attrs.pop("username", None)
            or attrs.get(self.username_field)
            or attrs.get("email")
        )
        password = attrs.get("password")
        user = _resolve_login_user(identifier or "")
        if not user:
            raise AuthenticationFailed("No active account found with the given credentials")

        authed = authenticate(
            request=self.context.get("request"),
            username=user.email,
            password=password,
        )
        if not authed:
            raise AuthenticationFailed("No active account found with the given credentials")

        if not authed.is_active or getattr(authed, "suspend", False):
            raise AuthenticationFailed("Account is inactive or suspended")

        self.user = authed
        update_last_login(None, authed)
        refresh = self.get_token(self.user)
        refresh.set_exp(lifetime=timedelta(days=90))
        access = refresh.access_token
        access.set_exp(lifetime=timedelta(days=60))

        AuditService.log(
            request=self.context.get("request"),
            user=authed,
            action="Login",
            submodule="Auth",
            event_type=AuditTrail.EventType.LOGIN,
            async_write=True,
        )

        return {
            "refresh": str(refresh),
            "access": str(access),
            "user_id": str(authed.pk),
            "email": authed.email,
            "username": authed.username,
            **_legacy_login_role_fields(authed),
        }


class LegacyEmailTokenObtainPairView(LegacyLoginPayloadMixin, TokenObtainPairView):
    """Old /login/ used by Flutter (email field, not username)."""

    permission_classes = [AllowAny]
    serializer_class = LegacyEmailTokenObtainPairSerializer


def _same_user_or_superuser(request, user_id: str) -> bool:
    if request.user.is_superuser:
        return True
    return str(request.user.pk) == str(user_id)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_app_pin(request):
    """Body: {user_id, pin} — 4-digit PIN, hashed."""
    user_id = request.data.get("user_id")
    pin = str(request.data.get("pin", "")).strip()

    if not user_id:
        return Response({"isError": True, "Message": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    if not pin or not pin.isdigit() or len(pin) != 4:
        return Response({"isError": True, "Message": "PIN must be exactly 4 digits"}, status=status.HTTP_400_BAD_REQUEST)
    if not _same_user_or_superuser(request, user_id):
        return Response(
            {"isError": True, "Message": "You don't have permission to set this user's PIN"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        target = User.objects.only("id", "first_name", "last_name", "app_pin", "app_pin_changed").get(pk=user_id)
    except User.DoesNotExist:
        return Response({"isError": True, "Message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    target.app_pin = make_password(pin)
    target.app_pin_changed = True
    target.save(update_fields=["app_pin", "app_pin_changed"])
    return Response(
        {"isError": False, "Message": f"PIN set successfully for {target.get_full_name()}"},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_app_pin(request):
    """Body: {user_id, pin}."""
    user_id = request.data.get("user_id")
    pin = str(request.data.get("pin", "")).strip()

    if not user_id:
        return Response({"isError": True, "Message": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    if not pin or not pin.isdigit() or len(pin) != 4:
        return Response({"isError": True, "Message": "PIN must be exactly 4 digits"}, status=status.HTTP_400_BAD_REQUEST)
    if not _same_user_or_superuser(request, user_id):
        return Response(
            {"isError": True, "Message": "You don't have permission to verify this user's PIN"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        target = User.objects.only("id", "app_pin").get(pk=user_id)
    except User.DoesNotExist:
        return Response({"isError": True, "Message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    if not target.app_pin:
        return Response({"isError": True, "Message": "PIN not set"}, status=status.HTTP_400_BAD_REQUEST)

    if check_password(pin, target.app_pin):
        return Response({"isError": False, "Message": "PIN verified"}, status=status.HTTP_200_OK)
    return Response({"isError": True, "Message": "Invalid PIN"}, status=status.HTTP_400_BAD_REQUEST)
