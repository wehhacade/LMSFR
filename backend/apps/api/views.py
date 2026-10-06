import time

from django.core.cache import cache
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.cache import SHORT, get_cache_stats, make_cache_key


class HealthCheckView(APIView):
    """
    GET /api/v3/health/

    Returns the operational status of every service dependency.
    Response is cached for SHORT seconds; includes Redis hit/miss header.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        cache_key = make_cache_key("health", "status")
        cached = cache.get(cache_key)
        if cached is not None:
            response = Response(cached)
            response["X-Cache"] = "HIT"
            return response

        t_start = time.perf_counter()

        # --- Database ---
        try:
            connection.ensure_connection()
            db_ok = True
        except Exception as exc:
            db_ok = False
            db_error = str(exc)
        else:
            db_error = None

        # --- Redis ---
        try:
            cache.set("_health_ping", "pong", 5)
            redis_ok = cache.get("_health_ping") == "pong"
            redis_stats = get_cache_stats()
        except Exception as exc:
            redis_ok = False
            redis_stats = {"error": str(exc)}

        # --- Celery ---
        try:
            from config.celery import app as celery_app
            inspector = celery_app.control.inspect(timeout=0.3)
            workers = inspector.active()
            celery_ok = workers is not None
            worker_count = len(workers) if workers else 0
        except Exception:
            celery_ok = False
            worker_count = 0

        elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)
        all_ok = db_ok and redis_ok

        payload = {
            "status": "healthy" if all_ok else "degraded",
            "response_time_ms": elapsed_ms,
            "services": {
                "database": {
                    "status": "ok" if db_ok else "error",
                    **({"error": db_error} if db_error else {}),
                },
                "redis": {
                    "status": "ok" if redis_ok else "error",
                    "memory": redis_stats.get("used_memory_human", "?"),
                    "clients": redis_stats.get("connected_clients", 0),
                    "hit_rate": redis_stats.get("hit_rate", "N/A"),
                    "total_keys": redis_stats.get("total_keys", 0),
                },
                "celery": {
                    "status": "ok" if celery_ok else "no_workers",
                    "active_workers": worker_count,
                },
            },
        }

        cache.set(cache_key, payload, SHORT)
        status_code = 200 if all_ok else 503
        response = Response(payload, status=status_code)
        response["X-Cache"] = "MISS"
        return response
