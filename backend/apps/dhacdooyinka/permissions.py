from rest_framework import permissions


def can_view_dhacdo_module(user) -> bool:
    """Module/menu read access for full Dhacdooyin or Amni viewers (not Sirdoon-only)."""
    return user.has_perm("dhacdooyinka.view_dhacdooyinka") or user.has_perm(
        "dhacdooyinka.view_dhacdo_amni"
    )


class DhacdooyinkaPermission(permissions.BasePermission):
    """Read with view_dhacdooyinka or view_dhacdo_amni; writes require add/change/delete."""

    message = "You do not have permission to perform this action on dhacdooyinka."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "suspend", False) or not user.is_active:
            return False
        if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
            return True
        if request.method in permissions.SAFE_METHODS:
            return can_view_dhacdo_module(user)
        if request.method == "POST":
            return user.has_perm("dhacdooyinka.add_dhacdooyinka")
        if request.method in ("PUT", "PATCH"):
            return user.has_perm("dhacdooyinka.change_dhacdooyinka")
        if request.method == "DELETE":
            return user.has_perm("dhacdooyinka.delete_dhacdooyinka")
        return False
