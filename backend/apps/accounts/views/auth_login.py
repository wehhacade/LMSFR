from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers.auth import LoginSerializer, UserLoginSerializer
from apps.accounts.services.auth_service import AuthService
from apps.accounts.services.device_service import DeviceService
from apps.accounts.services.mobile_login_policy import (
    MOBILE_LOGIN_REQUIRED_DETAIL,
    is_mobile_client_request,
)
from apps.accounts.views.mobile_auth import normalize_legacy_login_payload
from apps.audit.models import AuditTrail
from apps.audit.services import AuditService


class LoginView(APIView):
    """POST /api/v3/auth/login/ — email/password login with optional OTP flow."""

    permission_classes = []
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=normalize_legacy_login_payload(request.data))
        serializer.is_valid(raise_exception=True)
        try:
            result = AuthService.login(
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

        if result.get("otp_required"):
            return Response(
                {"otp_required": True, "email": result["email"], "detail": "OTP required."},
                status=status.HTTP_200_OK,
            )

        user_data = UserLoginSerializer(result["user"], context={"request": request}).data
        DeviceService.record_login(request, result["user"])
        AuditService.log(
            request=request,
            user=result["user"],
            action=f"User logged in ({result['user'].email})",
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
