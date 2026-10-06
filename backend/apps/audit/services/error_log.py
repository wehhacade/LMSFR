from __future__ import annotations

import sys
import traceback

from apps.audit.services.meta import RequestMeta


class ErrorLogService:
    @staticmethod
    def log(
        *,
        request=None,
        user=None,
        exc: BaseException | None = None,
        trace_back: str = "",
        path: str = "",
        method: str = "",
        status_code: int | None = None,
        async_write: bool = True,
    ) -> None:
        if user is None and request is not None and getattr(request, "user", None) and request.user.is_authenticated:
            user = request.user

        meta = RequestMeta.from_request(request)
        if exc is not None:
            exc_info = sys.exc_info()
            expected = type(exc).__name__
            field_error = str(exc)
            tb = trace_back or traceback.format_exc()
            line_number = str(exc_info[2].tb_lineno) if exc_info[2] else ""
        else:
            expected = "Error"
            field_error = ""
            tb = trace_back
            line_number = ""

        payload = {
            "user_id": str(user.pk) if user and user.pk else None,
            "expected_error": expected[:255],
            "field_error": field_error[:4000],
            "trace_back": tb[:8000],
            "line_number": line_number[:32],
            "ip_address": meta.ip_address,
            "user_agent": meta.user_agent,
            "path": (path or getattr(request, "path", ""))[:255],
            "method": (method or getattr(request, "method", ""))[:10],
            "status_code": status_code,
        }

        if async_write:
            from apps.audit.tasks import write_error_log

            try:
                write_error_log.delay(payload)
            except Exception:
                from apps.audit.models import ErrorLog

                ErrorLog.objects.create(
                    user_id=payload["user_id"],
                    expected_error=payload["expected_error"],
                    field_error=payload["field_error"],
                    trace_back=payload["trace_back"],
                    line_number=payload["line_number"],
                    ip_address=payload["ip_address"],
                    user_agent=payload["user_agent"],
                    path=payload["path"],
                    method=payload["method"],
                    status_code=payload["status_code"],
                )
            return

        from apps.audit.models import ErrorLog

        ErrorLog.objects.create(
            user_id=payload["user_id"],
            expected_error=payload["expected_error"],
            field_error=payload["field_error"],
            trace_back=payload["trace_back"],
            line_number=payload["line_number"],
            ip_address=payload["ip_address"],
            user_agent=payload["user_agent"],
            path=payload["path"],
            method=payload["method"],
            status_code=payload["status_code"],
        )
