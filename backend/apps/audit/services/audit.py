from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.audit.models import AuditTrail
from apps.audit.services.meta import RequestMeta

User = get_user_model()


class AuditService:
    @staticmethod
    def log(
        *,
        request=None,
        user=None,
        action: str,
        submodule: str = "",
        event_type: str = AuditTrail.EventType.OTHER,
        module: str = "",
        page: str = "",
        click_target: str = "",
        entity_type: str = "",
        entity_id: str = "",
        details: dict | None = None,
        path: str = "",
        method: str = "",
        ip_address: str | None = None,
        operating_system: str | None = None,
        browser: str | None = None,
        network: str | None = None,
        async_write: bool = True,
    ) -> None:
        if user is None and request is not None and getattr(request, "user", None) and request.user.is_authenticated:
            user = request.user

        meta = RequestMeta.from_request(request)
        payload = {
            "user_id": str(user.pk) if user and user.pk else None,
            "event_type": event_type[:20],
            "action": action[:2000],
            "submodule": submodule[:120],
            "module": module[:80],
            "page": page[:255],
            "click_target": click_target[:255],
            "entity_type": entity_type[:80],
            "entity_id": entity_id[:64],
            "details": details or {},
            "ip_address": ip_address if ip_address is not None else meta.ip_address,
            "operating_system": (operating_system or meta.operating_system or "")[:120],
            "browser": (browser or meta.browser or "")[:120],
            "network": (network or meta.user_agent or "")[:120],
            "path": (path or getattr(request, "path", "") or page)[:255],
            "method": (method or getattr(request, "method", ""))[:10],
        }

        if async_write:
            from apps.audit.tasks import write_audit_trail

            try:
                write_audit_trail.delay(payload)
            except Exception:
                AuditService._write_sync(payload)
            return

        AuditService._write_sync(payload)

    @staticmethod
    def _write_sync(payload: dict) -> None:
        AuditTrail.objects.create(
            user_id=payload.get("user_id"),
            event_type=payload.get("event_type", AuditTrail.EventType.OTHER),
            action=payload.get("action", ""),
            submodule=payload.get("submodule", ""),
            module=payload.get("module", ""),
            page=payload.get("page", ""),
            click_target=payload.get("click_target", ""),
            entity_type=payload.get("entity_type", ""),
            entity_id=payload.get("entity_id", ""),
            details=payload.get("details") or {},
            ip_address=payload.get("ip_address"),
            operating_system=payload.get("operating_system", ""),
            browser=payload.get("browser", ""),
            network=payload.get("network", ""),
            path=payload.get("path", ""),
            method=payload.get("method", ""),
        )
