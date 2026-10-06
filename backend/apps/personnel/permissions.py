from rest_framework import permissions

from apps.accounts.permissions import _is_active, _is_privileged


class PersonnelPermission(permissions.BasePermission):
    """Base permission with view/add/change action mapping."""

    view_perm = ""
    add_perm = ""
    change_perm = ""
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not _is_active(user):
            return False
        if _is_privileged(user):
            return True
        action = getattr(view, "action", None)
        if action == "upload":
            dry_run = str(request.data.get("dry_run", "true")).strip().lower() != "false"
            if not dry_run:
                return user.has_perm("personnel.agent_import_apply") or user.has_perm(self.change_perm)
            return (
                user.has_perm("personnel.agent_import")
                or user.has_perm("personnel.agent_import_review")
                or user.has_perm(self.view_perm)
            )
        if action in ("import_upload", "import_validate", "import_preview", "import_apply"):
            if action == "import_apply":
                return user.has_perm("personnel.agent_import_apply")
            return user.has_perm("personnel.agent_import") or user.has_perm("personnel.agent_import_review")
        if action in ("transfer", "create"):
            return user.has_perm(self.add_perm) or user.has_perm("personnel.agent_transfer")
        if action in ("release", "extend"):
            return user.has_perm("personnel.restriction_release") or user.has_perm("personnel.restriction_update")
        if request.method in permissions.SAFE_METHODS:
            return user.has_perm(self.view_perm) or user.has_perm("accounts.view_agent")
        if request.method == "POST":
            return user.has_perm(self.add_perm)
        if request.method in ("PUT", "PATCH"):
            return user.has_perm(self.change_perm)
        return False


class AttendancePermission(PersonnelPermission):
    view_perm = "personnel.attendance_view"
    add_perm = "personnel.attendance_create"
    change_perm = "personnel.attendance_update"


class TransferPermission(PersonnelPermission):
    view_perm = "personnel.agent_transfer"
    add_perm = "personnel.agent_transfer"
    change_perm = "personnel.agent_transfer"


class RestrictionPermission(PersonnelPermission):
    view_perm = "personnel.restriction_view"
    add_perm = "personnel.restriction_create"
    change_perm = "personnel.restriction_update"


class ImportPermission(PersonnelPermission):
    view_perm = "personnel.agent_import_review"
    add_perm = "personnel.agent_import"
    change_perm = "personnel.agent_import_apply"
