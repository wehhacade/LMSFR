from django.contrib import admin

from apps.mobile.models import AppVersionPolicy, AppVersionRelease


@admin.register(AppVersionPolicy)
class AppVersionPolicyAdmin(admin.ModelAdmin):
    list_display = ("min_version_code", "latest_version_code", "apk_url", "updated_at")
    fields = ("min_version_code", "latest_version_code", "apk_url", "message")

    def has_add_permission(self, request):
        return not AppVersionPolicy.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AppVersionRelease)
class AppVersionReleaseAdmin(admin.ModelAdmin):
    list_display = ("version_code", "min_version_code", "apk_url", "message", "created_at")
    ordering = ("-created_at", "-id")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
