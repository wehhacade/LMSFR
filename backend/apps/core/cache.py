"""
Central cache utilities for the application.

Usage:
    from apps.core.cache import cache_response, invalidate_cache, SHORT, MEDIUM, LONG

Decorating a ViewSet or generic view method:
    @cache_response(timeout=MEDIUM)
    def retrieve(self, request, *args, **kwargs): ...

Invalidating on write:
    invalidate_cache("me:42")
"""

from __future__ import annotations

import hashlib
import logging
from functools import wraps

from django.core.cache import cache

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Timeout constants (seconds)
# ---------------------------------------------------------------------------
SHORT = 60       # volatile data: health checks, live counters
MEDIUM = 300     # session-scoped data: user profile, list views
LONG = 3600      # slow-changing data: config, enumerations


# ---------------------------------------------------------------------------
# Key helpers
# ---------------------------------------------------------------------------

def make_cache_key(prefix: str, *parts) -> str:
    """Build a deterministic cache key from a prefix and variable parts."""
    body = ":".join(str(p) for p in parts)
    return f"{prefix}:{body}"


def _request_cache_key(prefix: str, request, vary_on_auth: bool) -> str:
    """Build a per-request cache key that varies on user identity and query string."""
    if vary_on_auth and request.user.is_authenticated:
        identity = str(request.user.pk)
    else:
        identity = "anon"
    qs = request.META.get("QUERY_STRING", "")
    raw = f"{request.path}:{identity}:{qs}"
    digest = hashlib.md5(raw.encode(), usedforsecurity=False).hexdigest()  # noqa: S324
    return f"view:{prefix}:{digest}"


# ---------------------------------------------------------------------------
# Decorators
# ---------------------------------------------------------------------------

def cache_response(timeout: int = MEDIUM, key_prefix: str | None = None, vary_on_auth: bool = True):
    """
    Cache the JSON data returned by a ViewSet or generic-view method.

    Only caches HTTP 200 GET responses. Adds ``X-Cache: HIT/MISS`` header.

    Args:
        timeout:       TTL in seconds (use SHORT / MEDIUM / LONG constants).
        key_prefix:    Override the automatic prefix derived from class + method name.
        vary_on_auth:  Include the authenticated user's PK in the cache key so
                       different users never share cached responses.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(view_instance, request, *args, **kwargs):
            # Only cache safe methods
            if request.method not in ("GET", "HEAD"):
                return func(view_instance, request, *args, **kwargs)

            prefix = key_prefix or f"{view_instance.__class__.__name__}.{func.__name__}"
            cache_key = _request_cache_key(prefix, request, vary_on_auth)

            cached_data = cache.get(cache_key)
            if cached_data is not None:
                from rest_framework.response import Response  # local import avoids circular
                response = Response(cached_data)
                response["X-Cache"] = "HIT"
                logger.debug("Cache HIT  key=%s", cache_key)
                return response

            response = func(view_instance, request, *args, **kwargs)
            if getattr(response, "status_code", None) == 200 and hasattr(response, "data"):
                cache.set(cache_key, response.data, timeout)
                response["X-Cache"] = "MISS"
                logger.debug("Cache MISS key=%s  ttl=%ds", cache_key, timeout)
            return response

        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# Invalidation helpers
# ---------------------------------------------------------------------------

def invalidate_cache(pattern: str) -> int:
    """
    Delete all Redis keys whose name contains *pattern*.

    Uses SCAN so it is non-blocking even on large key-spaces.
    Returns the number of keys deleted.
    """
    try:
        from django_redis import get_redis_connection
        conn = get_redis_connection("default")
        keys = list(conn.scan_iter(f"*{pattern}*"))
        if keys:
            conn.delete(*keys)
            logger.info("Cache invalidated %d keys matching '%s'", len(keys), pattern)
        return len(keys)
    except Exception as exc:
        logger.warning("Cache invalidation failed for pattern '%s': %s", pattern, exc)
        return 0


def invalidate_user_cache(user_id: int | str) -> int:
    """Invalidate profile and auth-user cache entries for *user_id*."""
    uid = str(user_id)
    deleted = 0
    for pattern in (f":me:{uid}", f"me:{uid}", f":me_perms:{uid}", f"me_perms:{uid}",
                      f":auth_user:{uid}", f"auth_user:{uid}"):
        deleted += invalidate_cache(pattern)
    return deleted


PERMISSION_ASSIGNMENTS_CACHE_KEY = "rbac:permission_assignments"


def invalidate_permission_assignments_cache() -> None:
    """Drop cached /groups/permission-assignments/ payload after RBAC changes."""
    try:
        cache.delete(PERMISSION_ASSIGNMENTS_CACHE_KEY)
    except Exception as exc:
        logger.warning("Permission assignments cache delete failed: %s", exc)
    invalidate_cache("permission_assignments")


def invalidate_users_stats_cache() -> None:
    """Drop cached /users/stats/ and dashboard responses after user roster changes."""
    invalidate_cache("users.stats")
    invalidate_cache("users.dashboard")


def get_cache_stats() -> dict:
    """Return basic Redis info useful for health checks and monitoring."""
    try:
        from django_redis import get_redis_connection
        conn = get_redis_connection("default")
        info = conn.info()
        return {
            "connected": True,
            "used_memory_human": info.get("used_memory_human", "?"),
            "connected_clients": info.get("connected_clients", 0),
            "keyspace_hits": info.get("keyspace_hits", 0),
            "keyspace_misses": info.get("keyspace_misses", 0),
            "hit_rate": _hit_rate(info),
            "evicted_keys": info.get("evicted_keys", 0),
            "total_keys": conn.dbsize(),
        }
    except Exception as exc:
        return {"connected": False, "error": str(exc)}


def _hit_rate(info: dict) -> str:
    hits = info.get("keyspace_hits", 0)
    misses = info.get("keyspace_misses", 0)
    total = hits + misses
    if total == 0:
        return "N/A"
    return f"{hits / total * 100:.1f}%"
