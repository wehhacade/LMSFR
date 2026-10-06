from rest_framework import permissions


def _is_privileged(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or user.is_staff or getattr(user, "is_admin", False))
    )


def client_permissions_for_user(user) -> list[str]:
    """Permissions list for /auth/me/ (includes role-injected visitor/survey access)."""
    from apps.surveys.permissions import survey_permissions_for_user
    from apps.visitors.permissions import visitor_permissions_for_user

    perms = set(survey_permissions_for_user(user))
    perms.update(visitor_permissions_for_user(user))
    return sorted(perms)


def _is_active(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "suspend", False):
        return False
    return bool(user.is_active)


class IsActiveUser(permissions.BasePermission):
    """Deny access for suspended or inactive accounts."""

    message = "Account is inactive or suspended."

    def has_permission(self, request, view):
        return _is_active(request.user)


class IsAdminUser(permissions.BasePermission):
    """Allow staff, superuser, or is_admin users."""

    message = "Admin privileges required."

    def has_permission(self, request, view):
        return _is_privileged(request.user)


class _ModelCrudPermission(permissions.BasePermission):
    """Map HTTP methods to Django model perms. Subclasses set view/add/change/delete."""

    view_perm: str = ""
    add_perm: str = ""
    change_perm: str = ""
    delete_perm: str = ""
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not _is_active(user):
            return False
        if _is_privileged(user):
            return True
        if request.method in permissions.SAFE_METHODS:
            return user.has_perm(self.view_perm)
        if request.method == "POST":
            return user.has_perm(self.add_perm)
        if request.method in ("PUT", "PATCH"):
            return user.has_perm(self.change_perm)
        if request.method == "DELETE":
            return user.has_perm(self.delete_perm)
        return False


class UserPermission(_ModelCrudPermission):
    view_perm = "accounts.view_user"
    add_perm = "accounts.add_user"
    change_perm = "accounts.change_user"
    delete_perm = "accounts.delete_user"
    message = "You do not have permission to manage users."


class GroupPermission(_ModelCrudPermission):
    view_perm = "auth.view_group"
    add_perm = "auth.add_group"
    change_perm = "auth.change_group"
    delete_perm = "auth.delete_group"
    message = "You do not have permission to manage groups."


class PermissionCatalogPermission(permissions.BasePermission):
    """Read-only access to the permission catalog."""

    message = "You do not have permission to view permissions."

    def has_permission(self, request, view):
        user = request.user
        if not _is_active(user):
            return False
        if _is_privileged(user):
            return True
        if request.method not in permissions.SAFE_METHODS:
            return False
        return user.has_perm("auth.view_permission")


class CanViewAgents(permissions.BasePermission):
    """Read-only access to agent profiles (Ciidan list, field agents)."""

    message = "You do not have permission to view agents."

    def has_permission(self, request, view):
        user = request.user
        if not _is_active(user):
            return False
        if _is_privileged(user):
            return True
        return user.has_perm("accounts.view_agent") or getattr(user, "is_agent", False)


class AgentPermission(permissions.BasePermission):
    """Read with view_agent (or is_agent); writes require add/change/delete_agent."""

    message = "You do not have permission to perform this action on agents."

    def has_permission(self, request, view):
        user = request.user
        if not _is_active(user):
            return False
        if _is_privileged(user):
            return True
        action = getattr(view, "action", None)
        if action == "eligible_users":
            return user.has_perm("accounts.add_agent")
        if action in ("app_users", "search_staff", "search_hrm"):
            return user.has_perm("accounts.view_agent")
        if action == "create_from_staff":
            return user.has_perm("accounts.add_agent")
        if action == "change_county":
            return user.has_perm("accounts.change_agent")
        if action == "bulk_reset_passwords":
            # Selected agents: change_user / change_agent. County-wide select-all stays superuser-only (enforced in view).
            return (
                bool(user.is_superuser)
                or user.has_perm("accounts.change_user")
                or user.has_perm("accounts.change_agent")
            )
        if action == "reset_password_to_phone":
            return user.has_perm("accounts.change_user") or user.has_perm("accounts.change_agent")
        if request.method in permissions.SAFE_METHODS:
            return user.has_perm("accounts.view_agent") or getattr(user, "is_agent", False)
        if request.method == "POST":
            return user.has_perm("accounts.add_agent")
        if request.method in ("PUT", "PATCH"):
            return user.has_perm("accounts.change_agent")
        if request.method == "DELETE":
            return user.has_perm("accounts.delete_agent")
        return False
