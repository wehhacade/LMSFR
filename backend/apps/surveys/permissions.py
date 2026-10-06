from rest_framework import permissions

from apps.surveys.services.deadline_notifications import is_survey_mobile_user


def _is_survey_field_user(user) -> bool:
    """Mobile survey collectors (survey-mobile / is_mobile), not dashboard builders."""
    return is_survey_mobile_user(user)


SURVEY_FIELD_PERMISSIONS = frozenset({
    "surveys.view_survey",
    "surveys.view_response",
    "surveys.add_response",
})


def survey_permissions_for_user(user) -> list[str]:
    """Permissions exposed to clients; survey-mobile field users get survey access."""
    perms = set(user.get_all_permissions())
    if _is_survey_field_user(user):
        perms.update(SURVEY_FIELD_PERMISSIONS)
    return sorted(perms)


class SurveyPermission(permissions.BasePermission):
    """Read requires view_survey; writes require add/change/delete. Admins bypass."""

    message = "You do not have permission to perform this action on surveys."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "suspend", False) or not user.is_active:
            return False
        if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
            return True
        # Survey-mobile field apps: list/view live surveys only (no builder writes).
        if _is_survey_field_user(user):
            return request.method in permissions.SAFE_METHODS
        if request.method in permissions.SAFE_METHODS:
            return user.has_perm("surveys.view_survey")
        if request.method == "POST":
            return user.has_perm("surveys.add_survey")
        if request.method in ("PUT", "PATCH"):
            return user.has_perm("surveys.change_survey")
        if request.method == "DELETE":
            return user.has_perm("surveys.delete_survey")
        return False


class ResponsePermission(permissions.BasePermission):
    """List/read responses with view_survey; submit with view_survey or add_response.

    DELETE is restricted to superusers and Dev user-type accounts only.
    """

    message = "You do not have permission to perform this action on survey responses."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "suspend", False) or not user.is_active:
            return False

        if request.method == "DELETE":
            from apps.accounts.call_roles import is_dev

            return is_dev(user)

        if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
            return True
        if _is_survey_field_user(user):
            if request.method in permissions.SAFE_METHODS:
                return True
            if request.method == "POST":
                return True
            return False
        if request.method in permissions.SAFE_METHODS:
            return user.has_perm("surveys.view_survey") or user.has_perm("surveys.view_response")
        if request.method == "POST":
            return user.has_perm("surveys.add_response") or user.has_perm("surveys.view_survey")
        if request.method in ("PUT", "PATCH"):
            return user.has_perm("surveys.change_response") or user.has_perm("surveys.change_survey")
        return False
