from rest_framework import permissions


class SuspectPermission(permissions.BasePermission):
    """Read with view_suspect; writes require add/change/delete. Admins bypass.

    TipPhone field agents (is_agent / is_mobile) may list and register via POST
    even when Django model perms were not granted on their group.
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "suspend", False) or not user.is_active:
            return False
        if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
            return True
        # Field agents use TipPhone (POST list + register) without dashboard perms.
        if getattr(user, "is_agent", False) or getattr(user, "is_mobile", False):
            if request.method in permissions.SAFE_METHODS or request.method == "POST":
                return True
        if request.method in permissions.SAFE_METHODS:
            return user.has_perm("suspects.view_suspect")
        if request.method == "POST":
            return user.has_perm("suspects.add_suspect")
        if request.method in ("PUT", "PATCH"):
            return user.has_perm("suspects.change_suspect")
        if request.method == "DELETE":
            return user.has_perm("suspects.delete_suspect")
        return False
