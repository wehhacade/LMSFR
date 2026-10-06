from __future__ import annotations

import logging
import random

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import OTPCode, User
from apps.accounts.services.mobile_login_policy import assert_web_login_allowed

logger = logging.getLogger(__name__)


class AuthService:
    @staticmethod
    def login(email: str, password: str, *, mobile_client: bool = False) -> dict:
        user = authenticate(username=email, password=password)
        if user is None:
            try:
                user_obj = User.objects.get(email=email)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None
        if user is None:
            raise ValueError("Invalid email or password.")
        if not user.is_active:
            raise ValueError("Your account is inactive. Contact an administrator.")
        if user.suspend:
            raise ValueError("Your account is suspended. Contact an administrator.")

        assert_web_login_allowed(user, mobile_client=mobile_client)

        if getattr(settings, "OTP_REQUIRED", False):
            code = AuthService.issue_otp(user)
            if settings.DEBUG:
                logger.info("OTP for %s: %s", email, code)
            return {"otp_required": True, "email": user.email, "user": user}

        return AuthService._tokens_for_user(user)

    @staticmethod
    def issue_otp(user: User) -> str:
        code = f"{random.randint(0, 999999):06d}"
        OTPCode.objects.update_or_create(user=user, defaults={"number": code})
        return code

    @staticmethod
    def verify_otp(email: str, code: str, *, mobile_client: bool = False) -> dict:
        try:
            user = User.objects.get(email=email)
            otp = OTPCode.objects.get(user=user)
        except (User.DoesNotExist, OTPCode.DoesNotExist):
            raise ValueError("Invalid OTP") from None
        if otp.number != str(code).strip():
            raise ValueError("Invalid OTP")
        otp.delete()
        if not user.is_active or user.suspend:
            raise ValueError("Account suspended")
        assert_web_login_allowed(user, mobile_client=mobile_client)
        return AuthService._tokens_for_user(user)

    @staticmethod
    def _tokens_for_user(user: User) -> dict:
        update_last_login(None, user)
        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": user,
            "otp_required": False,
        }

    @staticmethod
    def logout(refresh_token: str) -> None:
        token = RefreshToken(refresh_token)
        token.blacklist()

    @staticmethod
    def forgot_password(email: str) -> None:
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return
        code = AuthService.issue_otp(user)
        if settings.DEBUG:
            logger.info("Password reset OTP for %s: %s", email, code)

    @staticmethod
    def reset_password(email: str, code: str, new_password: str) -> None:
        try:
            user = User.objects.get(email=email)
            otp = OTPCode.objects.get(user=user)
        except (User.DoesNotExist, OTPCode.DoesNotExist):
            raise ValueError("Invalid reset code") from None
        if otp.number != str(code).strip():
            raise ValueError("Invalid reset code")
        user.set_password(new_password)
        user.password_changed = True
        user.save(update_fields=["password", "password_changed"])
        otp.delete()

    @staticmethod
    def change_password(user: User, current_password: str, new_password: str) -> None:
        if not user.check_password(current_password):
            raise ValueError("Current password is incorrect")
        user.set_password(new_password)
        user.password_changed = True
        user.save(update_fields=["password", "password_changed"])
