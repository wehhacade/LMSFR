from django.core.paginator import Paginator
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.baaris.models import BaarisCitizenProfile
from apps.baaris.permissions import BaarisPermission
from apps.baaris.register_service import register_baaris_citizen
from apps.baaris.serializers import BaarisProfileSerializer, BaarisRegisterSerializer
from apps.baaris.services.analytics import baaris_analytics, baaris_stats
from apps.suspects.face_service import normalize_phone
from apps.suspects.legacy_suspect_row import legacy_suspect_row
from apps.suspects.models import Suspect
from apps.suspects.photo_utils import coerce_picture_upload, resolve_photo_url
from apps.suspects.queries import suspect_app_list_qs
from apps.suspects.wanted_sync import ensure_wanted_suspect, unlink_wanted_suspect
from apps.mobile.models import WantedPerson, WantedType
from apps.accounts.models import Country
from django.db.models import Q


def _baaris_perms(view):
    return permission_classes([IsAuthenticated, IsActiveUser, BaarisPermission])(view)


@_baaris_perms
@api_view(["GET"])
def stats(request):
    return Response(baaris_stats())


@_baaris_perms
@api_view(["GET"])
def analytics(request):
    range_str = request.query_params.get("range", "7d")
    return Response(baaris_analytics(range_str=range_str))


def _wanted_row(w, request) -> dict:
    suspect = ensure_wanted_suspect(w)
    photo_name = ""
    if w.photo:
        try:
            photo_name = w.photo.name or ""
        except Exception:
            photo_name = ""
    return {
        "id": w.id,
        "suspect_id": suspect.id,
        "full_name": w.full_name,
        "gender": w.gender or "",
        "phone": w.phone or "",
        "mother_name": w.mother_name or "",
        "citizenship": w.citizenship.name if w.citizenship else None,
        "citizenship_id": w.citizenship_id,
        "wanted_type": w.wanted_type.name if w.wanted_type else None,
        "wanted_type_id": w.wanted_type_id,
        "wanted_status": w.wanted_status or "",
        "priority": w.priority or "",
        "details": w.details or "",
        "photo_url": resolve_photo_url(photo_name, request) if photo_name else None,
        "date_recorded": w.date_recorded.isoformat() if w.date_recorded else None,
        "created_by_id": w.created_by_id,
    }


@_baaris_perms
@api_view(["GET", "POST"])
def wanted_list(request):
    """Shared wanted registry — list (GET) and create (POST)."""
    if request.method == "GET":
        page_number = int(request.query_params.get("page", 1) or 1)
        page_size = min(int(request.query_params.get("page_size", 10) or 10), 100)
        search = (request.query_params.get("search") or "").strip()
        qs = WantedPerson.objects.select_related("citizenship", "wanted_type").order_by("-date_recorded")
        if search:
            qs = qs.filter(
                Q(full_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(mother_name__icontains=search)
                | Q(gender__icontains=search)
                | Q(wanted_status__icontains=search)
                | Q(priority__icontains=search)
                | Q(details__icontains=search)
            )
        paginator = Paginator(qs, page_size)
        page = paginator.get_page(page_number)
        return Response(
            {
                "results": [_wanted_row(w, request) for w in page.object_list],
                "count": paginator.count,
                "page": page.number,
                "total_pages": paginator.num_pages,
            }
        )

    # CREATE
    data = request.data
    name = (data.get("full_name") or data.get("name") or "").strip()
    if not name:
        return Response({"detail": "full_name is required"}, status=status.HTTP_400_BAD_REQUEST)

    phone = normalize_phone(str(data.get("phone") or ""))
    wanted_type = None
    type_id = data.get("wanted_type_id")
    type_name = (data.get("wanted_type") or "").strip()
    if type_id:
        wanted_type = WantedType.objects.filter(pk=type_id).first()
    elif type_name:
        wanted_type, _ = WantedType.objects.get_or_create(name=type_name)

    citizenship = None
    cid = data.get("citizenship_id")
    if cid:
        citizenship = Country.objects.filter(pk=cid).first()

    w = WantedPerson(
        full_name=name,
        gender=(data.get("gender") or "").strip(),
        phone=phone if len(phone) == 10 else (data.get("phone") or ""),
        mother_name=(data.get("mother_name") or data.get("mother") or "").strip(),
        citizenship=citizenship,
        wanted_type=wanted_type,
        wanted_status=(data.get("wanted_status") or "Wanted").strip(),
        priority=(data.get("priority") or "Medium").strip(),
        details=(data.get("details") or "").strip(),
        created_by=request.user,
    )
    photo = request.FILES.get("photo") or data.get("photo")
    if photo:
        try:
            w.photo = coerce_picture_upload(photo)
        except Exception:
            w.photo = photo
    w.save()
    ensure_wanted_suspect(w, embed_photo=True)
    return Response(_wanted_row(w, request), status=status.HTTP_201_CREATED)


@_baaris_perms
@api_view(["GET", "PATCH", "DELETE"])
def wanted_detail(request, wanted_id: int):
    try:
        w = WantedPerson.objects.select_related("citizenship", "wanted_type").get(pk=wanted_id)
    except WantedPerson.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(_wanted_row(w, request))

    if request.method == "DELETE":
        unlink_wanted_suspect(w)
        w.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    data = request.data
    for field, key in (
        ("full_name", "full_name"),
        ("gender", "gender"),
        ("mother_name", "mother_name"),
        ("wanted_status", "wanted_status"),
        ("priority", "priority"),
        ("details", "details"),
    ):
        if key in data:
            setattr(w, field, (data.get(key) or "").strip())
    if "name" in data and "full_name" not in data:
        w.full_name = (data.get("name") or "").strip()
    if "phone" in data:
        phone = normalize_phone(str(data.get("phone") or ""))
        w.phone = phone if len(phone) == 10 else (data.get("phone") or "")
    if "wanted_type_id" in data:
        w.wanted_type = WantedType.objects.filter(pk=data.get("wanted_type_id")).first()
    if "citizenship_id" in data:
        w.citizenship = Country.objects.filter(pk=data.get("citizenship_id")).first()
    photo_changed = bool(data.get("photo") or request.FILES.get("photo"))
    if photo_changed:
        photo = request.FILES.get("photo") or data.get("photo")
        try:
            w.photo = coerce_picture_upload(photo)
        except Exception:
            w.photo = photo
    w.save()
    suspect = ensure_wanted_suspect(w)
    if photo_changed:
        from apps.suspects.models import SuspectFaceEmbedding

        SuspectFaceEmbedding.objects.filter(suspect=suspect).delete()
        ensure_wanted_suspect(w, embed_photo=True)
    return Response(_wanted_row(w, request))


@_baaris_perms
@api_view(["GET"])
def wanted_types(request):
    rows = list(WantedType.objects.order_by("name").values("id", "name"))
    return Response({"results": rows})


# --- existing citizen endpoints below ---


@_baaris_perms
@api_view(["POST"])
def register_complete(request):
    """Citizen ID form — creates Suspect(source=baaris) + BaarisCitizenProfile."""
    serializer = BaarisRegisterSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        return Response(
            {"isError": True, "Message": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    result = register_baaris_citizen(serializer.validated_data, request.user)
    return Response(
        {
            "isError": False,
            "Message": "Muwaadinka waa la diiwaan geliyey.",
            "suspect_id": result.suspect.pk,
            "profile_id": result.profile.pk,
            "case_ref": result.suspect.case_ref,
            "source": result.suspect.source,
        },
        status=status.HTTP_201_CREATED,
    )


@_baaris_perms
@api_view(["GET", "POST"])
def citizen_list(request):
    """Browse baaris registry only (not shared search)."""
    data = request.data if request.method == "POST" else request.query_params
    page_number = int(data.get("page", 1) or 1)
    page_size = min(int(data.get("page_size", 10) or 10), 100)
    search = (data.get("search") or data.get("searchQuery") or "").strip()
    county = data.get("county", "") or ""
    filter_date = data.get("dateFilter", "") or data.get("filter_date", "") or ""

    qs = suspect_app_list_qs(
        search=search,
        county=county,
        filter_date=filter_date,
        source=Suspect.Source.BAARIS,
    ).select_related("baaris_profile", "address", "created_by")
    paginator = Paginator(qs, page_size)
    page = paginator.get_page(page_number)
    message = []
    for s in page.object_list:
        row = legacy_suspect_row(s, request=request)
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
            "source": Suspect.Source.BAARIS,
        },
        status=status.HTTP_200_OK,
    )


@_baaris_perms
@api_view(["GET"])
def citizen_detail(request, suspect_id: int):
    """Full baaris dossier. Cross-registry identity still available via suspect APIs."""
    try:
        profile = BaarisCitizenProfile.objects.select_related(
            "suspect",
            "suspect__capture_county",
            "suspect__created_by",
            "created_by",
        ).get(suspect_id=suspect_id)
    except BaarisCitizenProfile.DoesNotExist:
        # Shared identity hit without baaris dossier — return identity card only.
        try:
            suspect = Suspect.objects.select_related(
                "suspect_type",
                "capture_county",
                "created_by",
            ).get(pk=suspect_id)
        except Suspect.DoesNotExist:
            return Response(
                {"isError": True, "Message": "Qofka lama helin."},
                status=status.HTTP_404_NOT_FOUND,
            )
        row = legacy_suspect_row(suspect, request=request)
        return Response(
            {
                "isError": False,
                "identity": row,
                "profile": None,
                "dossier_available": False,
                "Message": "Aqoonsi ayaa la helay — dossier baaris ma jiro.",
            }
        )

    ser = BaarisProfileSerializer(profile, context={"request": request})
    return Response(
        {
            "isError": False,
            "identity": legacy_suspect_row(profile.suspect, request=request),
            "profile": ser.data,
            "dossier_available": True,
        }
    )
