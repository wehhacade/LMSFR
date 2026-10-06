"""
Mobile-optimised suspect API — few round-trips, small JSON, paginated lists.

Base: /api/v3/suspect/mobile/
"""

from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models.user import County, Region, Relationship, SubCounty
from apps.accounts.permissions import IsActiveUser
from apps.core.cache import LONG, MEDIUM, make_cache_key, invalidate_cache

from .mobile_payload import (
    MOBILE_PAGE_SIZE_DEFAULT,
    mobile_case_rows,
    mobile_guarantor_rows,
    mobile_suspect_detail,
    mobile_suspect_rows,
)
from .models import MOGADISHU_DISTRICTS, Suspect, SuspectStatus
from .permissions import SuspectPermission
from .serializers import DamiinCaseCreateSerializer, LegacySuspectWriteSerializer, SuspectStatusSerializer
from .services import create_damiin_and_case, parse_damiin_payload


def _mobile_perms(view):
    return permission_classes([IsAuthenticated, IsActiveUser, SuspectPermission])(view)


def _int_param(request, key: str, default: int) -> int:
    raw = request.GET.get(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


@_mobile_perms
@api_view(["GET"])
def mobile_lookups(request):
    cache_key = make_cache_key("suspect", "mobile", "lookups")
    data = cache.get(cache_key)
    if data is None:
        data = {
            "status_types": SuspectStatusSerializer(SuspectStatus.objects.all(), many=True).data,
            "risk_levels": [{"id": c.value, "name": c.label} for c in Suspect.Risk],
            "regions": [
                {"id": row["id"], "legacy_id": row["id"], "name": row["name"], "code": row["code"]}
                for row in Region.objects.order_by("name").values("id", "name", "code")[:20]
            ],
            "districts": [
                {
                    "id": row["id"],
                    "legacy_id": row["id"],
                    "name": row["name"],
                    "code": row["code"],
                    "region_id": row["region_id"],
                }
                for row in County.objects.select_related("region").order_by("name").values(
                    "id", "name", "code", "region_id"
                )[:500]
            ]
            if County.objects.exists()
            else [{"id": i, "name": d} for i, d in enumerate(MOGADISHU_DISTRICTS, start=1)],
            "sub_counties": [
                {
                    "id": row["id"],
                    "legacy_id": row["id"],
                    "cid": row["county_id"],
                    "name": row["name"],
                    "code": row["code"],
                }
                for row in SubCounty.objects.order_by("name").values("id", "county_id", "name", "code")[:800]
            ],
            "relationships": [
                {"id": row["id"], "name": row["relationship"]}
                for row in Relationship.objects.order_by("id").values("id", "relationship")
            ],
        }
        cache.set(cache_key, data, LONG)
    response = Response(data)
    response["Cache-Control"] = f"private, max-age={MEDIUM}"
    return response


@_mobile_perms
@api_view(["GET", "POST"])
def mobile_suspects(request):
    if request.method == "POST":
        serializer = LegacySuspectWriteSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            errors = [str(e) for errs in serializer.errors.values() for e in (errs if isinstance(errs, list) else [errs])]
            return Response({"Digniin!": errors}, status=status.HTTP_400_BAD_REQUEST)
        suspect = serializer.save()
        invalidate_cache("suspect")
        return Response(
            {
                "message": "Si wanaagsan ayaad u xareysay xogta shaqsiga. Mahadsanid!",
                "id": suspect.id,
                "case_ref": suspect.case_ref,
            },
            status=status.HTTP_201_CREATED,
        )

    district = (request.GET.get("county_name") or request.GET.get("district") or "").strip()
    search = request.GET.get("search", "").strip()
    page = _int_param(request, "page", 1)
    page_size = _int_param(request, "page_size", MOBILE_PAGE_SIZE_DEFAULT)
    payload = mobile_suspect_rows(district=district, search=search, page=page, page_size=page_size, request=request)
    response = Response(payload)
    response["Cache-Control"] = "private, max-age=15"
    return response


@_mobile_perms
@api_view(["GET"])
def mobile_suspect_detail_view(request, id: int):
    data = mobile_suspect_detail(id, request=request)
    if not data:
        return Response({"message": "Lama helin tuhunsanaha."}, status=status.HTTP_404_NOT_FOUND)
    return Response(data)


@_mobile_perms
@api_view(["GET", "POST"])
def mobile_guarantors(request, id: int):
    if request.method == "GET":
        return Response(mobile_guarantor_rows(id, request=request))

    serializer = DamiinCaseCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    payload = parse_damiin_payload(serializer.validated_data, suspect_id=id)
    try:
        case = create_damiin_and_case(payload, request.user)
    except ValidationError as exc:
        return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
    invalidate_cache("suspect")
    return Response(
        {
            "message": f"Caseka {case.suspect.name} is successfully registered",
            "case_id": case.id,
            "case_code": case.case_code,
        },
        status=status.HTTP_201_CREATED,
    )


@_mobile_perms
@api_view(["GET"])
def mobile_suspect_cases(request, id: int):
    rows = mobile_case_rows(id)
    if not rows:
        return Response({"Message": "Cases lama helin", "isError": True}, status=status.HTTP_404_NOT_FOUND)
    return Response({"Message": rows, "isError": False})
