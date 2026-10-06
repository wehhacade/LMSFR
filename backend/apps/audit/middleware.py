import time

from django.utils.deprecation import MiddlewareMixin

from apps.audit.services.meta import RequestMeta


class APITrafficMiddleware(MiddlewareMixin):
    """Log API request latency asynchronously — skips static/media."""

    def process_request(self, request):
        if not request.path.startswith("/api/"):
            return None
        request._audit_start = time.perf_counter()
        return None

    def process_response(self, request, response):
        if not request.path.startswith("/api/"):
            return response
        start = getattr(request, "_audit_start", None)
        if start is None:
            return response

        duration_ms = int((time.perf_counter() - start) * 1000)
        user_id = None
        if getattr(request, "user", None) and request.user.is_authenticated:
            user_id = str(request.user.pk)

        meta = RequestMeta.from_request(request)
        payload = {
            "user_id": user_id,
            "method": request.method[:10],
            "path": request.path[:255],
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "ip_address": meta.ip_address,
        }

        try:
            from apps.audit.tasks import write_api_traffic

            write_api_traffic.delay(payload)
        except Exception:
            pass

        return response
