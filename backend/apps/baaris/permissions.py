from rest_framework import permissions


class BaarisPermission(permissions.BasePermission):
    """Read with view; writes require add/change/delete. Admins bypass."""

    message = "You do not have permission to perform this action on baaris."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "suspend", False) or not user.is_active:
            return False
        if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
            return True
        # Field agents (is_agent / is_mobile) can use TipPhone baaris APIs.
        if getattr(user, "is_agent", False) or getattr(user, "is_mobile", False):
            if request.method in permissions.SAFE_METHODS or request.method == "POST":
                return True
        if request.method in permissions.SAFE_METHODS:
            return user.has_perm("baaris.view_baariscitizenprofile") or user.has_perm(
                "baaris.view_baaris_module"
            )
        if request.method == "POST":
            return user.has_perm("baaris.add_baariscitizenprofile")
        if request.method in ("PUT", "PATCH"):
            return user.has_perm("baaris.change_baariscitizenprofile")
        if request.method == "DELETE":
            return user.has_perm("baaris.delete_baariscitizenprofile")
        return False
