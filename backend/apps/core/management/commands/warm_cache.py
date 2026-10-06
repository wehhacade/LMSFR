"""
Management command to pre-warm the Redis cache.

Usage:
    python manage.py warm_cache
    python manage.py warm_cache --verbose
"""

import time

from django.core.cache import cache
from django.core.management.base import BaseCommand

from apps.core.cache import LONG, MEDIUM, SHORT, get_cache_stats, make_cache_key


class Command(BaseCommand):
    help = "Pre-warm the Redis cache with frequently accessed data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Print detailed progress for each warm-up step.",
        )

    def handle(self, *args, **options):
        verbose = options["verbose"]
        self.stdout.write(self.style.MIGRATE_HEADING("Starting cache warm-up…"))

        steps = [
            ("connectivity", self._warm_connectivity),
            ("health_sentinel", self._warm_health_sentinel),
            ("user_count", self._warm_user_count),
        ]

        passed = 0
        for name, fn in steps:
            t0 = time.perf_counter()
            try:
                result = fn()
                elapsed = (time.perf_counter() - t0) * 1000
                self.stdout.write(
                    self.style.SUCCESS(f"  ✓ {name:<25} {elapsed:6.1f} ms   {result}")
                )
                passed += 1
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f"  ✗ {name:<25} FAILED: {exc}"))

        # Summary
        stats = get_cache_stats()
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Cache stats after warm-up:"))
        self.stdout.write(f"  Connected         : {stats.get('connected')}")
        self.stdout.write(f"  Used memory       : {stats.get('used_memory_human', '?')}")
        self.stdout.write(f"  Total keys        : {stats.get('total_keys', '?')}")
        self.stdout.write(f"  Hit rate (session): {stats.get('hit_rate', 'N/A')}")
        self.stdout.write(f"  Hits              : {stats.get('keyspace_hits', 0)}")
        self.stdout.write(f"  Misses            : {stats.get('keyspace_misses', 0)}")
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(f"Warm-up complete — {passed}/{len(steps)} steps passed.")
        )

    # ------------------------------------------------------------------
    # Individual warm-up steps
    # ------------------------------------------------------------------

    def _warm_connectivity(self) -> str:
        """Verify Redis is reachable by doing a round-trip set/get."""
        key = make_cache_key("warm", "ping")
        cache.set(key, "pong", SHORT)
        value = cache.get(key)
        assert value == "pong", f"Expected 'pong', got {value!r}"
        return "Redis round-trip OK"

    def _warm_health_sentinel(self) -> str:
        """Cache a sentinel health payload so the first /health/ request is instant."""
        from django.db import connection

        # DB check
        try:
            connection.ensure_connection()
            db_ok = True
        except Exception:
            db_ok = False

        # Redis check
        try:
            cache.set("_health_check", "ok", 5)
            redis_ok = cache.get("_health_check") == "ok"
        except Exception:
            redis_ok = False

        payload = {
            "status": "healthy" if (db_ok and redis_ok) else "degraded",
            "database": "ok" if db_ok else "error",
            "redis": "ok" if redis_ok else "error",
        }
        cache.set(make_cache_key("health", "status"), payload, SHORT)
        return f"db={payload['database']} redis={payload['redis']}"

    def _warm_user_count(self) -> str:
        """Cache the current user count (cheap query, often needed by admin)."""
        from django.contrib.auth import get_user_model

        User = get_user_model()
        count = User.objects.count()
        cache.set(make_cache_key("users", "count"), count, MEDIUM)
        return f"{count} user(s) cached"
