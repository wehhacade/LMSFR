from celery import shared_task


@shared_task(ignore_result=True, max_retries=2, default_retry_delay=5)
def write_audit_trail(payload: dict) -> None:
    from apps.audit.models import AuditTrail

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


@shared_task(ignore_result=True, max_retries=2, default_retry_delay=5)
def write_error_log(payload: dict) -> None:
    from apps.audit.models import ErrorLog

    ErrorLog.objects.create(
        user_id=payload.get("user_id"),
        expected_error=payload.get("expected_error", ""),
        field_error=payload.get("field_error", ""),
        trace_back=payload.get("trace_back", ""),
        line_number=payload.get("line_number", ""),
        ip_address=payload.get("ip_address"),
        user_agent=payload.get("user_agent", ""),
        path=payload.get("path", ""),
        method=payload.get("method", ""),
        status_code=payload.get("status_code"),
    )


@shared_task(ignore_result=True, max_retries=1, default_retry_delay=3)
def write_api_traffic(payload: dict) -> None:
    from apps.audit.models import APITrafficLog

    APITrafficLog.objects.create(
        user_id=payload.get("user_id"),
        method=payload.get("method", ""),
        path=payload.get("path", ""),
        status_code=payload.get("status_code", 0),
        duration_ms=payload.get("duration_ms", 0),
        ip_address=payload.get("ip_address"),
    )
