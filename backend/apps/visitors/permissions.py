from rest_framework import permissions

from apps.accounts.permissions import _is_active, _is_privileged

BOQDE_TYPE = "boqde"
# Accept common spellings used in the field / older accounts.
BOQDE_TYPE_ALIASES = frozenset({"boqde", "booqde", "bode", "boode"})

BOQDE_PERMISSIONS = frozenset(
    {
        "visitors.view_visitor",
        "visitors.add_visitor",
        "visitors.change_visitor",
        "visitors.delete_visitor",
    }
)


def is_boqde(user) -> bool:
    ut = getattr(user, "user_type", None)
    name = (getattr(ut, "name", None) or "").strip().lower()
    return name in BOQDE_TYPE_ALIASES


def visitor_permissions_for_user(user) -> list[str]:
    """Inject CRUD perms for boqde user-type into /auth/me/."""
    if is_boqde(user):
        return sorted(BOQDE_PERMISSIONS)
    return []


class VisitorsPermission(permissions.BasePermission):
    """boqde user-type or Django model perms; admins bypass."""

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not _is_active(user):
            return False
        if _is_privileged(user):
            return True
        if is_boqde(user):
            return True
        if request.method in permissions.SAFE_METHODS:
            return user.has_perm("visitors.view_visitor")
        if request.method == "POST":
            return user.has_perm("visitors.add_visitor")
        if request.method in ("PUT", "PATCH"):
            return user.has_perm("visitors.change_visitor")
        if request.method == "DELETE":
            return user.has_perm("visitors.delete_visitor")
        return False
