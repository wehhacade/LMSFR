from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.permissions import IsActiveUser
from apps.accounts.serializers.auth import (
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    UserMeSerializer,
    VerifyOTPSerializer,
)
from apps.accounts.services.mobile_login_policy import (
    MOBILE_LOGIN_REQUIRED_DETAIL,
    is_mobile_client_request,
)
from apps.accounts.services.auth_service import AuthService
from apps.accounts.services.device_service import DeviceService
from apps.accounts.services.mobile_login_policy import (
    MOBILE_LOGIN_REQUIRED_DETAIL,
    is_mobile_client_request,
)
from apps.audit.models import AuditTrail
from apps.audit.services import AuditService
from apps.core.cache import MEDIUM, invalidate_user_cache, make_cache_key

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveUser]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ProfileUpdateSerializer
        return UserMeSerializer

    def get_object(self):
        return (
            User.objects.select_related("directorate", "department", "county", "user_type", "agent_profile")
            .prefetch_related("groups", "user_permissions__content_type")
            .get(pk=self.request.user.pk)
        )

    def retrieve(self, request, *args, **kwargs):
        # ?fresh=1 skips Redis cache so permission changes apply without logout.
        if request.query_params.get("fresh") != "1":
            cache_key = make_cache_key("me", request.user.pk)
            cached_data = cache.get(cache_key)
            if cached_data is not None:
                response = Response(cached_data)
                response["X-Cache"] = "HIT"
                return response

        response = super().retrieve(request, *args, **kwargs)
        if response.status_code == 200 and request.query_params.get("fresh") != "1":
            cache_key = make_cache_key("me", request.user.pk)
            cache.set(cache_key, response.data, MEDIUM)
            response["X-Cache"] = "MISS"
        return response

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        if response.status_code in (200, 204):
            invalidate_user_cache(request.user.pk)
        return response

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class MePermissionsView(APIView):
    """Lightweight permission poll for live sidebar updates (?fresh=1 bypasses cache)."""

    permission_classes = [permissions.IsAuthenticated, IsActiveUser]

    def get(self, request):
        if request.query_params.get("fresh") != "1":
            cache_key = make_cache_key("me_perms", request.user.pk)
            cached = cache.get(cache_key)
            if cached is not None:
                response = Response({"permissions": cached})
                response["X-Cache"] = "HIT"
                return response

        user = (
            User.objects.prefetch_related("groups__permissions", "user_permissions__content_type")
            .get(pk=request.user.pk)
        )
        from apps.accounts.permissions import client_permissions_for_user

        perms = client_permissions_for_user(user)
        if request.query_params.get("fresh") != "1":
            cache.set(make_cache_key("me_perms", request.user.pk), perms, MEDIUM)
        response = Response({"permissions": perms})
        response["X-Cache"] = "MISS"
        return response


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveUser]

    def post(self, request):
        refresh = request.data.get("refresh")
        if refresh:
            try:
                AuthService.logout(refresh)
            except Exception:
                pass
        AuditService.log(
            request=request,
            action=f"User logged out ({request.user.email})",
            submodule="auth",
            event_type=AuditTrail.EventType.LOGOUT,
            module="auth",
        )
        invalidate_user_cache(request.user.pk)
        return Response({"detail": "Logged out successfully."})


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsActiveUser]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            AuthService.change_password(
                request.user,
                serializer.validated_data["current_password"],
                serializer.validated_data["new_password"],
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        invalidate_user_cache(request.user.pk)
        AuditService.log(
            request=request,
            action="Password changed",
            submodule="auth",
            event_type=AuditTrail.EventType.UPDATE,
            module="auth",
            entity_type="user",
            entity_id=str(request.user.pk),
        )
        return Response({"detail": "Password updated successfully."})


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        AuthService.forgot_password(serializer.validated_data["email"])
        return Response({"detail": "If the account exists, reset instructions were sent."})


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            AuthService.reset_password(
                serializer.validated_data["email"],
                serializer.validated_data["code"],
                serializer.validated_data["new_password"],
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Password reset successfully."})


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = AuthService.verify_otp(
                **serializer.validated_data,
                mobile_client=is_mobile_client_request(request),
            )
        except ValueError as exc:
            status_code = (
                status.HTTP_403_FORBIDDEN
                if str(exc) == MOBILE_LOGIN_REQUIRED_DETAIL
                else status.HTTP_401_UNAUTHORIZED
            )
            return Response({"detail": str(exc)}, status=status_code)

        from apps.accounts.serializers.auth import UserLoginSerializer

        user_data = UserLoginSerializer(result["user"], context={"request": request}).data
        DeviceService.record_login(request, result["user"])
        AuditService.log(
            request=request,
            user=result["user"],
            action=f"User logged in via OTP ({result['user'].email})",
            submodule="auth",
            event_type=AuditTrail.EventType.LOGIN,
            module="auth",
            entity_type="user",
            entity_id=str(result["user"].pk),
        )
        return Response(
            {
                "access": result["access"],
                "refresh": result["refresh"],
                "user": user_data,
            }
        )
