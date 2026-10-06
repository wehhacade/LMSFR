from rest_framework import permissions

AMNIGA_VIEW_PERMS = (
    "suspects.view_suspect",
    "accounts.view_agent",
    "suspects.view_daily_report",
)


class AmnigaModulePermission(permissions.BasePermission):
    """Read-only module access — any Amniga launcher permission grants dashboard access."""

    message = "You do not have permission to access Amniga operations data."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "suspend", False) or not user.is_active:
            return False
        if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
            return True
        if request.method not in permissions.SAFE_METHODS:
            return False
        return any(user.has_perm(perm) for perm in AMNIGA_VIEW_PERMS)
