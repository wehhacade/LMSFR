from rest_framework import permissions


class CanViewForce(permissions.BasePermission):
    """Read access to Force personnel records."""

    message = "You do not have permission to view forces."

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
        return user.has_perm("forces.view_force")
