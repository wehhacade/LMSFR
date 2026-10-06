from rest_framework import permissions


class DisarmamentPermission(permissions.BasePermission):
    """Read with view_disarmamentrecord; writes require add/change/delete. Admins bypass."""

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "suspend", False) or not user.is_active:
            return False
        if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
            return True
        if request.method in permissions.SAFE_METHODS:
            return user.has_perm("hubkadhigis.view_disarmamentrecord")
        if request.method == "POST":
            return user.has_perm("hubkadhigis.add_disarmamentrecord")
        if request.method in ("PUT", "PATCH"):
            return user.has_perm("hubkadhigis.change_disarmamentrecord")
        if request.method == "DELETE":
            return user.has_perm("hubkadhigis.delete_disarmamentrecord")
        return False
