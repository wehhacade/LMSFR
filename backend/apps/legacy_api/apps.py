from django.apps import AppConfig


class LegacyApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.legacy_api"
    verbose_name = "Legacy mobile API (v1 paths)"
