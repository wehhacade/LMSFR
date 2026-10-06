from __future__ import annotations

from apps.audit.models import AuditTrail
from apps.audit.services import AuditService


class AuditedViewSetMixin:
    """Log create, update, delete, and detail views for API resources."""

    audit_module: str = ""
    audit_entity: str = ""

    def _audit_entity_label(self, instance) -> str:
        for attr in ("email", "name", "personal_fullname", "case_ref", "title"):
            val = getattr(instance, attr, None)
            if val:
                return str(val)
        return str(instance.pk)

    def _audit_log(
        self,
        event_type: str,
        action: str,
        *,
        entity_id=None,
        page: str = "",
        click_target: str = "",
        details: dict | None = None,
    ) -> None:
        AuditService.log(
            request=self.request,
            action=action,
            submodule=self.audit_module or self.audit_entity or "api",
            event_type=event_type,
            module=self.audit_module,
            page=page,
            click_target=click_target,
            entity_type=self.audit_entity,
            entity_id=str(entity_id) if entity_id else "",
            details=details or {},
        )

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        instance = self.get_object()
        self._audit_log(
            AuditTrail.EventType.VIEW,
            f"Viewed {self.audit_entity} {self._audit_entity_label(instance)}",
            entity_id=instance.pk,
            page=f"{self.audit_module}/{self.audit_entity}",
        )
        return response

    def perform_create(self, serializer):
        instance = serializer.save()
        self._audit_log(
            AuditTrail.EventType.CREATE,
            f"Created {self.audit_entity} {self._audit_entity_label(instance)}",
            entity_id=instance.pk,
        )
        return instance

    def perform_update(self, serializer):
        instance = serializer.save()
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Updated {self.audit_entity} {self._audit_entity_label(instance)}",
            entity_id=instance.pk,
        )
        return instance

    def perform_destroy(self, instance):
        label = self._audit_entity_label(instance)
        pk = instance.pk
        instance.delete()
        self._audit_log(
            AuditTrail.EventType.DELETE,
            f"Deleted {self.audit_entity} {label}",
            entity_id=pk,
        )
