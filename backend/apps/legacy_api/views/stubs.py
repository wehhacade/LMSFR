"""Placeholder endpoints for modules not yet ported from old /APIs."""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsActiveUser
from apps.legacy_api.helpers import legacy_err


def module_stub(module_name: str):
    @permission_classes([IsAuthenticated, IsActiveUser])
    @api_view(["GET", "POST", "PUT", "PATCH", "DELETE"])
    def view(request, *_args, **_kwargs):
        return legacy_err(
            f"{module_name} module is not yet available in LMSBR v2. "
            "Use the new REST endpoints or contact the administrator."
        )

    view.__name__ = f"stub_{module_name.replace('-', '_')}"
    return view
