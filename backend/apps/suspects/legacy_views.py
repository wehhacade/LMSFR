"""
Legacy mobile API paths (old /api/v2/ style) — fast queries, same behaviour.

Mounted under /api/v3/suspect/:
  POST suspects-create
  GET  suspects/
  GET  suspects_list_temp?county_name=
  GET  suspect-types/
  GET  get-suspect-status/
  GET  address/
  POST damiinka/create
  POST create-damiinka-api
  POST register-complete
  GET  damiinka/view/<id>
  GET  get-suspect-cases/<id>
  GET  get-damiintayaasha/<id>
"""

from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models.user import County, Region, Relationship, SubCounty
from apps.accounts.permissions import IsActiveUser
from apps.core.cache import LONG, make_cache_key, invalidate_cache

from .legacy_suspect_row import legacy_suspect_row
from .mobile_payload import MOBILE_PAGE_SIZE_DEFAULT, mobile_case_rows, mobile_guarantor_rows, mobile_suspect_rows
from .photo_utils import picture_payload_present
from .models import MOGADISHU_DISTRICTS, Suspect, SuspectStatus
from .permissions import SuspectPermission
from .register_service import register_suspect_complete as register_complete_service
from .serializers import DamiinCaseCreateSerializer, LegacySuspectWriteSerializer, SuspectStatusSerializer
from .services import create_damiin_and_case, parse_damiin_payload
from .response_hooks import after_suspect_registered
from .simplified_serializers import SimplifiedRegisterSerializer


def _legacy_perms(view):
    return permission_classes([IsAuthenticated, IsActiveUser, SuspectPermission])(view)


def _cache_get(key: str, builder, timeout: int = LONG):
    data = cache.get(key)
    if data is not None:
        return Response(data)
    data = builder()
    cache.set(key, data, timeout)
    return Response(data)


@_legacy_perms
@api_view(["POST"])
def suspects_create(request):
    serializer = LegacySuspectWriteSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        errors = []
        for field_errors in serializer.errors.values():
            if isinstance(field_errors, list):
                errors.extend(field_errors)
            else:
                errors.append(str(field_errors))
        return Response({"Digniin!": errors}, status=status.HTTP_400_BAD_REQUEST)
    suspect = serializer.save()
    invalidate_cache("suspect")
    if request.user.is_authenticated:
        after_suspect_registered(suspect, request.user)
    return Response(
        {
            "message": "Si wanaagsan ayaad u xareysay xogta shaqsiga. Mahadsanid!",
            "id": suspect.id,
            "case_ref": suspect.case_ref,
        },
        status=status.HTTP_201_CREATED,
    )


def _require_field(data, key: str, message: str) -> str | None:
    value = data.get(key)
    if isinstance(value, list):
        value = value[0] if value else None
    if value in (None, "", "null", "undefined"):
        return message
    return None


def _payload_value(data, key: str, default: str = "") -> str:
    value = data.get(key, default)
    if isinstance(value, list):
        value = value[0] if value else default
    return str(value or default).strip()


@_legacy_perms
@api_view(["POST"])
def create_suspects_api(request):
    """Old create-suspect-api — full mobile registration with picture."""
    has_picture = bool(request.FILES.get("picture")) or picture_payload_present(
        request.data.get("picture") or request.data.get("picture_base64")
    )
    if not has_picture:
        return Response(
            {"isError": True, "Message": "Fadlan sawir ka qaad tuhunsaha"},
            status=status.HTTP_200_OK,
        )

    required = [
        ("fullname", "Fadlan qor magaca tuhunsaha oo saddexan"),
        ("mother", "Fadlan qor magaca hooyada"),
        ("nickname", "Fadlan qor Afgarashada(Naneys) tuhunsaha"),
        ("dob", "Fadlan Dooro taariikhda dhalashada"),
        ("pob", "Fadlan qor goobta dhalashada"),
        ("gender", "Fadlan dooro jinsiga"),
        ("nationality", "Fadlan dooro dhalashada"),
        ("phone_self", "Fadlan qor lambarka telefoonka ee shakhsiga"),
        ("parent_phone", "Fadlan qor lambarka telefoonka ee waalidka"),
        ("marital", "Fadlan dooro heerka guurka"),
        ("children", "Fadlan qor tirada caruurta"),
        ("occupation", "Fadlan qor shaqada"),
        ("place_occupation", "Fadlan qor goobta shaqada"),
        ("tribe", "Fadlan qor qabiilka"),
        ("identity_card", "Fadlan qor lambarka kaarka aqoonsiga"),
        ("county", "Fadlan dooro degmo"),
        ("sub_county", "Fadlan dooro degmo hoose"),
        ("suspect_type", "Fadlan dooro nooca tuhunsaha"),
        ("description", "Fadlan qor sharraxaadda"),
    ]
    for key, msg in required:
        if _require_field(request.data, key, msg):
            return Response({"isError": True, "Message": msg}, status=status.HTTP_200_OK)

    if Suspect.objects.filter(
        name=_payload_value(request.data, "fullname"),
        mother_name=_payload_value(request.data, "mother"),
        alias=_payload_value(request.data, "nickname"),
    ).exists():
        return Response(
            {"isError": True, "Message": "Tuhunsanahaan Waa Diiwaan Gashanyahay"},
            status=status.HTTP_200_OK,
        )

    serializer = LegacySuspectWriteSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        errors = []
        for field_errors in serializer.errors.values():
            if isinstance(field_errors, list):
                errors.extend(str(e) for e in field_errors)
            else:
                errors.append(str(field_errors))
        return Response({"Digniin!": errors}, status=status.HTTP_400_BAD_REQUEST)

    suspect = serializer.save()
    invalidate_cache("suspect")
    if request.user.is_authenticated:
        after_suspect_registered(suspect, request.user)
    return Response(
        {
            "Message": "Si wanaagsan ayaad u xareysay xogta shaqsiga. Mahadsanid!",
            "isError": False,
            "id": suspect.id,
            "case_ref": suspect.case_ref,
        },
        status=status.HTTP_201_CREATED,
    )


@_legacy_perms
@api_view(["POST"])
def register_suspect_complete(request):
    """Fast 3-step form — suspect + case + damiin in one transaction."""
    serializer = SimplifiedRegisterSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        first_error = next(iter(serializer.errors.values()))
        message = first_error[0] if isinstance(first_error, list) else str(first_error)
        if isinstance(message, dict):
            message = next(iter(message.values()))
            message = message[0] if isinstance(message, list) else str(message)
        return Response({"isError": True, "Message": str(message)}, status=status.HTTP_200_OK)

    try:
        result = register_complete_service(serializer.validated_data, request.user)
    except ValidationError as exc:
        detail = exc.detail
        if isinstance(detail, dict):
            first = next(iter(detail.values()))
            message = first[0] if isinstance(first, list) else str(first)
        else:
            message = str(detail)
        return Response({"isError": True, "Message": message}, status=status.HTTP_200_OK)

    invalidate_cache("suspect")
    suspect = result.suspect
    case = result.case
    return Response(
        {
            "Message": "Si wanaagsan ayaad u xareysay xogta shaqsiga. Mahadsanid!",
            "isError": False,
            "suspect_id": suspect.id,
            "id": suspect.id,
            "case_id": case.id,
            "case_code": case.case_code,
            "case_ref": suspect.case_ref,
            "damiin_id": result.damiin_id,
        },
        status=status.HTTP_201_CREATED,
    )


def _legacy_list_response(request, district: str = ""):
    search = request.GET.get("search", "").strip()
    if request.GET.get("page"):
        page = int(request.GET.get("page", 1))
        page_size = int(request.GET.get("page_size", MOBILE_PAGE_SIZE_DEFAULT))
        return Response(mobile_suspect_rows(district=district, search=search, page=page, page_size=page_size, request=request))
    payload = mobile_suspect_rows(district=district, search=search, page=1, page_size=250, request=request)
    return Response(payload["results"])


@_legacy_perms
@api_view(["GET"])
def suspects_list(request):
    return _legacy_list_response(request)


@_legacy_perms
@api_view(["GET"])
def suspects_list_temp(request):
    district = (request.GET.get("county_name") or request.GET.get("district") or "").strip()
    return _legacy_list_response(request, district=district)


@_legacy_perms
@api_view(["GET"])
def suspect_types_list(request):
    return _cache_get(
        make_cache_key("suspect", "status-types"),
        lambda: SuspectStatusSerializer(SuspectStatus.objects.all(), many=True).data,
    )


@_legacy_perms
@api_view(["GET"])
def get_suspect_status(request):
    cache_key = make_cache_key("suspect", "status-legacy")
    cached = cache.get(cache_key)
    if cached is not None:
        return Response({"Message": cached, "isError": False})
    message = [
        {"id": row.id, "name": row.name}
        for row in SuspectStatus.objects.only("id", "name").order_by("name")
    ]
    cache.set(cache_key, message, LONG)
    return Response({"Message": message, "isError": False})


@_legacy_perms
@api_view(["GET"])
def get_relationships(request):
    cached = cache.get(make_cache_key("suspect", "relationships"))
    if cached is not None:
        return Response({"Message": cached, "isError": False})
    message = [{"id": row.id, "name": row.relationship} for row in Relationship.objects.only("id", "relationship").order_by("id")]
    cache.set(make_cache_key("suspect", "relationships"), message, LONG)
    return Response({"Message": message, "isError": False})


@_legacy_perms
@api_view(["GET"])
def get_region(request):
    def build():
        return [
            {"id": row.id, "name": row.name}
            for row in Region.objects.only("id", "name").order_by("name")[:50]
        ]

    cached = cache.get(make_cache_key("suspect", "regions"))
    if cached is not None:
        return Response({"Message": cached, "isError": False})
    message = build()
    cache.set(make_cache_key("suspect", "regions"), message, LONG)
    return Response({"Message": message, "isError": False})


@_legacy_perms
@api_view(["GET"])
def get_sub_county(request):
    county_id = request.GET.get("county") or request.GET.get("cid")
    qs = SubCounty.objects.select_related("county").only("id", "name", "county_id", "code").order_by("name")
    if county_id:
        if str(county_id).isdigit():
            qs = qs.filter(county_id=int(county_id))
        else:
            qs = qs.filter(county_id=county_id)
    message = [
        {"id": row.id, "legacy_id": row.id, "cid": row.county_id, "name": row.name, "code": row.code}
        for row in qs[:500]
    ]
    return Response({"Message": message, "isError": False})


@_legacy_perms
@api_view(["GET"])
def address_list(request):
    region_id = request.GET.get("region") or request.GET.get("region_id")
    qs = County.objects.select_related("region").only("id", "name", "code", "region_id").order_by("name")
    if region_id:
        if str(region_id).isdigit():
            qs = qs.filter(region_id=int(region_id))
        else:
            qs = qs.filter(region_id=region_id)

    def build():
        counties = [
            {
                "id": row.id,
                "legacy_id": row.id,
                "name": row.name,
                "code": row.code,
                "region_id": row.region_id,
            }
            for row in qs[:500]
        ]
        if counties:
            return counties
        return [{"id": i, "name": d} for i, d in enumerate(MOGADISHU_DISTRICTS, start=1)]

    cache_key = make_cache_key("suspect", "address", region_id or "all")
    return _cache_get(cache_key, build)


def _create_damiin_response(request, suspect_id: int | None = None):
    serializer = DamiinCaseCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    payload = parse_damiin_payload(serializer.validated_data, suspect_id=suspect_id)
    try:
        case = create_damiin_and_case(payload, request.user)
    except ValidationError as exc:
        return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
    invalidate_cache("suspect")
    return Response(
        {
            "Message": f"Caseka {case.suspect.name} is successfully registered",
            "isError": False,
            "case_id": case.id,
            "case_code": case.case_code,
        },
        status=status.HTTP_201_CREATED,
    )


@_legacy_perms
@api_view(["POST"])
def damiinka_create(request):
    return _create_damiin_response(request)


@_legacy_perms
@api_view(["POST"])
def create_damiinka_api(request):
    return _create_damiin_response(request)


@_legacy_perms
@api_view(["GET"])
def damiinka_view(request, id: int):
    return Response(mobile_guarantor_rows(id, request=request))


@_legacy_perms
@api_view(["GET"])
def get_suspect_cases(request, suspect_id: int):
    rows = mobile_case_rows(suspect_id)
    if not rows:
        return Response({"Message": "Cases lama helin", "isError": True}, status=status.HTTP_404_NOT_FOUND)
    return Response({"Message": rows, "isError": False})


@_legacy_perms
@api_view(["GET"])
def get_damiintayaasha(request, suspect_id: int):
    rows = mobile_guarantor_rows(suspect_id, request=request)
    if not rows:
        return Response({"Message": "Damiinadaada lama helin", "isError": True}, status=status.HTTP_404_NOT_FOUND)
    return Response({"Message": rows, "isError": False})
