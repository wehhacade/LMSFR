from rest_framework import permissions


class CanViewAudit(permissions.BasePermission):
    """View audit trails — admin/staff or audit.view_audittrail permission."""

    message = "You do not have permission to view audit trails."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
            return True
        return user.has_perm("audit.view_audittrail")


class CanViewErrorLogs(permissions.BasePermission):
    message = "You do not have permission to view error logs."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
            return True
        return user.has_perm("audit.view_errorlog")


class CanViewAPITraffic(permissions.BasePermission):
    message = "You do not have permission to view API traffic logs."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
            return True
        return user.has_perm("audit.view_apitrafficlog")
