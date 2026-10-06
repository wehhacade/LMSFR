from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.audit.services.meta import RequestMeta

User = get_user_model()


class DeviceService:
    @staticmethod
    def record_login(request, user: User) -> None:
        meta = RequestMeta.from_request(request)
        device_label = f"{meta.browser} on {meta.operating_system}".strip(" on ")

        from apps.accounts.models import UserDevice

        UserDevice.objects.create(
            user=user,
            device=device_label[:100],
            action="login",
            ip_address=meta.ip_address,
            operating_system=meta.operating_system,
            browser=meta.browser,
            network=meta.user_agent[:120] if meta.user_agent else "",
        )

        user.last_login_device = device_label[:500]
        user.save(update_fields=["last_login_device"])
