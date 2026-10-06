"""Old /APIs v2 suspect endpoints — suspect-list, single-suspect-data, get-suspect-list."""

from django.contrib.auth import get_user_model
from django.core.paginator import Paginator
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.legacy_api.helpers import legacy_catch, legacy_ok, legacy_validation
from apps.suspects.legacy_suspect_row import legacy_suspect_row
from apps.suspects.models import Suspect
from apps.suspects.permissions import SuspectPermission
from apps.suspects.queries import suspect_app_list_qs
from apps.suspects.wanted_sync import ensure_all_wanted_suspects, wanted_mobile_row

User = get_user_model()


def _can_view_suspects(user) -> bool:
    if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
        return True
    # TipPhone agents/mobile users — group may have no Django model perms.
    if getattr(user, "is_agent", False) or getattr(user, "is_mobile", False):
        return True
    return user.has_perm("suspects.view_suspect")


def _suspect_v2_perms(view):
    """Apply after @api_view so DRF copies permission_classes onto the view class."""
    return permission_classes([IsAuthenticated, IsActiveUser, SuspectPermission])(view)


@api_view(["POST"])
@_suspect_v2_perms
@legacy_catch
def suspect_list(request):
    user_id = request.data.get("user_id")
    if not user_id:
        return legacy_validation("user_id is required")
    try:
        target_user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return legacy_validation("User not found")

    if not _can_view_suspects(target_user):
        return legacy_validation("Ma haysatid Ogalaansho")

    page_number = int(request.data.get("page", 1) or 1)
    county = request.data.get("county", "") or ""
    filter_dates = request.data.get("dateFilter", "") or ""
    search_query = (request.data.get("searchQuery") or "").strip()
    # Shared search when searching; role-scoped browse when source is sent.
    # Legacy clients that omit source while browsing stay on amniga (safe default).
    source = (request.data.get("source") or "").strip().lower()
    if source not in ("", "amniga", "baaris"):
        source = ""
    if not search_query and not source:
        source = "amniga"

    # Synchronize Wanted records into stable Suspect identities before applying
    # the normal search, source, county, and pagination rules.
    wanted_by_suspect = ensure_all_wanted_suspects()
    wanted_search_ids: set[int] = set()
    if search_query:
        needle = search_query.casefold()
        for suspect_id, wanted in wanted_by_suspect.items():
            haystack = " ".join(
                (
                    wanted.full_name or "",
                    wanted.mother_name or "",
                    wanted.phone or "",
                    wanted.wanted_status or "",
                    wanted.priority or "",
                    wanted.details or "",
                    wanted.wanted_type.name if wanted.wanted_type_id else "",
                )
            ).casefold()
            if needle in haystack:
                wanted_search_ids.add(suspect_id)
    qs = suspect_app_list_qs(
        search=search_query,
        county=county,
        filter_date=filter_dates,
        source=source,
        extra_search_ids=wanted_search_ids,
    )
    if source == Suspect.Source.BAARIS:
        qs = qs.select_related("baaris_profile")

    paginator = Paginator(qs, 10)
    page = paginator.get_page(page_number)
    message = []
    for s in page.object_list:
        wanted = wanted_by_suspect.get(s.pk)
        row = (
            wanted_mobile_row(wanted, s, request=request)
            if wanted is not None
            else legacy_suspect_row(s, user_id=user_id, request=request)
        )
        if source == Suspect.Source.BAARIS:
            try:
                profile = s.baaris_profile
            except Exception:
                profile = None
            row["waaxda"] = getattr(profile, "waaxda", "") or ""
            row["xaafadda"] = getattr(profile, "xaafadda", "") or ""
        message.append(row)
    return Response(
        {
            "Message": message,
            "total_pages": paginator.num_pages,
            "current_page": page_number,
            "isError": False,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@_suspect_v2_perms
@legacy_catch
def single_suspect_data(request):
    user_id = request.data.get("user_id")
    suspect_id = request.data.get("suspect_id")
    if not user_id or not suspect_id:
        return legacy_validation("user_id and suspect_id are required")
    try:
        target_user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return legacy_validation("User not found")

    if not _can_view_suspects(target_user):
        return legacy_validation("Ma haysatid Ogalaansho")

    try:
        suspect = (
            Suspect.objects.select_related(
                "suspect_type",
                "capture_county",
                "capture_sub_county",
                "address",
                "nationality",
                "baaris_profile",
            )
            .get(pk=suspect_id)
        )
    except Suspect.DoesNotExist:
        return legacy_validation("suspect is messing")

    row = legacy_suspect_row(suspect, user_id=user_id, request=request)
    if getattr(suspect, "source", "") == Suspect.Source.BAARIS:
        try:
            profile = suspect.baaris_profile
        except Exception:
            profile = None
        row["waaxda"] = getattr(profile, "waaxda", "") or ""
        row["xaafadda"] = getattr(profile, "xaafadda", "") or ""
    return legacy_ok(row)


@api_view(["GET"])
@_suspect_v2_perms
@legacy_catch
def get_user_suspects(request, user_id=None):
    if user_id:
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return legacy_validation("User not found")
    else:
        user = request.user

    rows = (
        Suspect.objects.filter(created_by=user)
        .only("id", "name", "phone", "created_at", "created_by_id")
        .order_by("-created_at")
    )
    message = [
        {
            "id": row.id,
            "name": row.name,
            "phone": row.phone or "",
            "date_registered": row.created_at,
            "created_by": row.created_by_id,
        }
        for row in rows
    ]
    return legacy_ok(message)
