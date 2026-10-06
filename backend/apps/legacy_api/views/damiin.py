"""Old /APIs damiin endpoints at root level."""

from collections import defaultdict

from django.core.paginator import Paginator
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.legacy_api.helpers import legacy_catch, legacy_err, legacy_ok, legacy_validation
from apps.suspects.mobile_payload import (
    mobile_damiin_cases,
    mobile_damiin_info,
    mobile_dhamaan_damiinada,
)
from apps.suspects.models import SuspectCase
from apps.suspects.permissions import SuspectPermission
from apps.suspects.photo_utils import resolve_photo_url


def _damiin_perms(view):
    return permission_classes([IsAuthenticated, IsActiveUser, SuspectPermission])(view)


@_damiin_perms
@api_view(["GET"])
@legacy_catch
def get_damiinada_info(request, damiin_id: int):
    payload = mobile_damiin_info(damiin_id, request=request)
    if not payload:
        return legacy_err("Damiinadaada lama helin", status_code=status.HTTP_404_NOT_FOUND)
    return legacy_ok(payload)


@_damiin_perms
@api_view(["GET"])
@legacy_catch
def get_damiin_cases(request, damiin_id: int):
    rows = mobile_damiin_cases(damiin_id)
    if not rows:
        return legacy_err("Cases lama helin", status_code=status.HTTP_404_NOT_FOUND)
    return legacy_ok(rows)


@_damiin_perms
@api_view(["GET", "POST"])
@legacy_catch
def get_dhamaan_damiinada(request):
    search_query = request.data.get("searchQuery") or request.query_params.get("searchQuery", "")
    county = request.data.get("county") or request.query_params.get("county", "dhamaan")
    rows = mobile_dhamaan_damiinada(search_query=search_query, county=county)
    return legacy_ok(rows)


@_damiin_perms
@api_view(["POST"])
@legacy_catch
def get_damiin_list(request):
    if not request.user.has_perm("suspects.view_suspectcase"):
        return legacy_validation("Ma haysatid Ogalaansho")

    page_number = int(request.data.get("page", 1) or 1)
    filter_date = request.data.get("dateFilter", "") or ""
    search_query = (request.data.get("searchQuery") or "").strip()

    qs = SuspectCase.objects.select_related(
        "damiin", "suspect", "damiin__county", "suspect__capture_county"
    ).order_by("-created_at")

    if filter_date:
        qs = qs.filter(created_at__date=filter_date)

    if search_query:
        qs = qs.filter(
            Q(damiin__name__icontains=search_query)
            | Q(damiin__phone__icontains=search_query)
            | Q(damiin__county__name__icontains=search_query)
            | Q(damiin__workplace__icontains=search_query)
        )

    grouped: dict[int, dict] = defaultdict(
        lambda: {
            "id": None,
            "picture": None,
            "name": None,
            "phone": None,
            "N_tuhunka": None,
            "degmada": None,
            "date": None,
            "suspect_count": 0,
            "goobta_shaqada": None,
            "suspects": [],
        }
    )

    for case in qs:
        damiin = case.damiin
        if not damiin:
            continue
        bucket = grouped[damiin.id]
        if bucket["id"] is None:
            suspect_ids = set()
            bucket.update(
                {
                    "id": damiin.id,
                    "picture": resolve_photo_url(damiin.picture_url, request) or None,
                    "name": damiin.name,
                    "phone": damiin.phone,
                    "degmada": damiin.county.name if damiin.county else None,
                    "date": damiin.created_at.date().isoformat() if damiin.created_at else None,
                    "goobta_shaqada": damiin.workplace or None,
                }
            )
        else:
            suspect_ids = {s["suspect_id"] for s in bucket["suspects"]}

        suspect = case.suspect
        if suspect and suspect.id not in suspect_ids:
            bucket["suspects"].append(
                {
                    "suspect_id": suspect.id,
                    "name": suspect.name,
                    "picture": resolve_photo_url(suspect.photo_url, request) or None,
                    "degmada": (
                        suspect.capture_county.name if suspect.capture_county else suspect.district or None
                    ),
                }
            )
            bucket["suspect_count"] = len(bucket["suspects"])

    damiin_list = list(grouped.values())
    paginator = Paginator(damiin_list, 10)
    page = paginator.get_page(page_number)
    return Response(
        {
            "Message": list(page.object_list),
            "total_pages": paginator.num_pages,
            "current_page": page_number,
            "isError": False,
        },
        status=status.HTTP_200_OK,
    )
