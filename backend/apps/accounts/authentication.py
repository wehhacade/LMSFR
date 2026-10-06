from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.core.cache import MEDIUM, make_cache_key

User = get_user_model()


class CachedJWTAuthentication(JWTAuthentication):
    """
    JWT auth that caches User rows in Redis after the first lookup.

    Avoids a PostgreSQL SELECT on every authenticated request when the user
    is already in cache (typical for /me/ with X-Cache: HIT).
    """

    def get_user(self, validated_token):
        user_id = validated_token.get("user_id")
        if user_id is None:
            return super().get_user(validated_token)

        cache_key = make_cache_key("auth_user", user_id)
        user = cache.get(cache_key)
        if user is not None:
            return user

        user = super().get_user(validated_token)
        if user is not None and (not user.is_active or getattr(user, "suspend", False)):
            return None
        cache.set(cache_key, user, MEDIUM)
        return user
