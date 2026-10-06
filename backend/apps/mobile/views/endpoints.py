"""Suspects, cars, reports, cabasho, wanted, documents, admin — Flutter APIs."""

from __future__ import annotations

import math
from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.core.paginator import Paginator
from django.db.models import Case, Count, F, FloatField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Cast, NullIf, Power
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.call_roles import is_taliye_all, is_taliye_qebeed, qeyb_county_ids
from apps.accounts.models import Agent, County, Department
from apps.accounts.permissions import IsActiveUser
from apps.accounts.services.app_activity import activity_snapshot, relative_activity_label
from apps.audit.models import AuditTrail
from apps.audit.services.audit import AuditService
from apps.legacy_api.helpers import legacy_catch, legacy_ok, legacy_validation
from apps.mobile.helpers import (
    APP_LOGIN_ACTION,
    build_tag_map,
    cached_car_modals,
    cached_documents_by_tag,
    format_user_lastlogin,
    serialize_last_login_at,
    get_modified_dates,
    is_clear,
    legacy_success,
    suspect_seen_by_user,
    user_permission_label,
    user_profile_url,
)
from apps.mobile.models import (
    CabashadaAppka,
    AgentAppInstallation,
    MobileTask,
    SuspectCar,
    SuspectCarModal,
    UserSuspectTag,
    WantedPerson,
)
from apps.suspects.legacy_suspect_row import legacy_suspect_row
from apps.suspects.models import Suspect, SuspectCase
from apps.suspects.photo_utils import coerce_picture_upload, resolve_photo_url

User = get_user_model()


def _can_view_suspects(user) -> bool:
    if user.is_superuser or user.is_staff or getattr(user, "is_admin", False):
        return True
    return user.has_perm("suspects.view_suspect")


def _car_photo_url(car, request):
    if not car.picture:
        return None
    name = getattr(car.picture, "name", "") or str(car.picture)
    return resolve_photo_url(name, request)


def _task_photo_url(task, request):
    if not task.picture:
        return None
    name = getattr(task.picture, "name", "") or str(task.picture)
    return resolve_photo_url(name, request)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def suspect_list_images(request):
    user_id = request.data.get("user_id")
    user = User.objects.get(pk=int(user_id))
    if not _can_view_suspects(user):
        return legacy_validation("Ogolaansho ma haystid")

    case_count = SuspectCase.objects.count()
    queryset = (
        Suspect.objects.select_related("suspect_type")
        .only("id", "name", "photo_url", "suspect_type")
        .order_by("-created_at")[:10]
    )
    suspect_ids = [s.id for s in queryset]
    tag_map = build_tag_map(user.pk, suspect_ids)
    total_suspect_count = len(suspect_ids)
    new_false_count = sum(1 for sid in suspect_ids if not suspect_seen_by_user(user.pk, sid, tag_map))

    message = [
        {
            "id": s.id,
            "name": s.name,
            "scount": total_suspect_count,
            "casecount": case_count,
            "new": suspect_seen_by_user(user.pk, s.id, tag_map),
            "photo": resolve_photo_url(s.photo_url, request),
        }
        for s in queryset
    ]
    return Response(
        {"Message": message, "new_false_count": new_false_count, "isError": False}
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def suspect_list_count(request):
    user_id = request.data.get("user_id")
    user = User.objects.get(pk=int(user_id))
    if not _can_view_suspects(user):
        return legacy_validation("Ogolaansho ma haystid")

    queryset = (
        Suspect.objects.filter(created_by_id=user_id)
        .only("id")
        .order_by("-created_at")
    )
    suspect_ids = list(queryset.values_list("id", flat=True))
    tag_map = build_tag_map(user.pk, suspect_ids)
    total_suspect_count = len(suspect_ids)
    case_count = SuspectCase.objects.count()
    new_false_count = sum(1 for sid in suspect_ids if not suspect_seen_by_user(user.pk, sid, tag_map))

    message = [
        {
            "id": sid,
            "scount": total_suspect_count,
            "casecount": case_count,
            "new": suspect_seen_by_user(user.pk, sid, tag_map),
        }
        for sid in suspect_ids
    ]
    return Response(
        {"Message": message, "new_false_count": new_false_count, "isError": False}
    )


@api_view(["PUT"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def update_suspect_tag(request, user_id, suspect_id):
    if not User.objects.filter(pk=user_id).exists():
        return legacy_validation("This user does not exist")
    if not Suspect.objects.filter(pk=suspect_id).exists():
        return legacy_validation("This suspect does not exist")

    tag_row, _ = UserSuspectTag.objects.get_or_create(
        user_id=user_id,
        suspect_id=suspect_id,
        defaults={"tag": "new", "click_count": 0},
    )
    tag_row.click_count += 1
    tag_row.tag = "old"
    tag_row.save(update_fields=["click_count", "tag"])
    return Response(
        legacy_success(
            {
                "message": f"Suspect tag updated for user {user_id}",
                "tag": tag_row.tag,
                "click_count": tag_row.click_count,
            }
        )
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def suspect_report(request):
    user_id = request.data.get("user_id")
    target = User.objects.get(pk=int(user_id))
    if not _can_view_suspects(target):
        return legacy_validation("Ma haysatid Ogalaansho")

    page_number = int(request.data.get("page", 1) or 1)
    start_date = request.data.get("start", "")
    end_date = request.data.get("end", "")
    county = request.data.get("county", 0)
    search_query = (request.data.get("searchQuery") or "").strip()

    qs = Suspect.objects.select_related(
        "suspect_type", "address", "created_by"
    ).order_by("-created_at")

    if start_date:
        qs = qs.filter(date_opp__gte=start_date)
    if end_date:
        qs = qs.filter(date_opp__lte=end_date)
    if county and str(county) not in ("0", ""):
        qs = qs.filter(address_id=int(county))

    if search_query:
        qs = qs.filter(
            Q(name__icontains=search_query)
            | Q(mother_name__icontains=search_query)
            | Q(alias__icontains=search_query)
            | Q(phone__icontains=search_query)
            | Q(occupation__icontains=search_query)
            | Q(created_by__email__icontains=search_query)
        )
    elif not (start_date or end_date or county):
        qs = qs[:10]

    paginator = Paginator(qs, 10)
    page = paginator.get_page(page_number)
    suspect_ids = [s.id for s in page.object_list]
    tag_map = build_tag_map(int(user_id), suspect_ids)

    message = []
    for suspect in page.object_list:
        row = legacy_suspect_row(suspect, request=request)
        row["seen"] = suspect_seen_by_user(int(user_id), suspect.id, tag_map)
        row["created_ago"] = get_modified_dates(suspect.created_at)
        message.append(row)

    return Response(
        {
            "Message": message,
            "total_pages": paginator.num_pages,
            "current_page": page_number,
            "isError": False,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def car_modal_list(request):
    return Response(cached_car_modals())


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def create_suspect_car(request):
    data = request.data
    photo_file = request.FILES.get("photo") or data.get("photo")
    if is_clear(photo_file):
        return legacy_validation("Fadlan sawir ka qaad gaariga")
    for field, msg in (
        ("car_model", "Fadlan dooro nooca gaariga"),
        ("suspect", "Fadlan dooro tuhunsaha"),
        ("plate_number", "Fadlan qor lambarka taargada"),
        ("description", "Fadlan qor faahfaahinta"),
        ("ownership", "Fadlan caddee milkiilaha gaadhiga"),
    ):
        if is_clear(data.get(field)):
            return legacy_validation(msg)

    if data.get("ownership") == "No":
        if is_clear(data.get("ownername")):
            return legacy_validation("Fadlan qor magaca milkiilaha")
        if is_clear(data.get("ownerphone")):
            return legacy_validation("Fadlan qor lambarka telefoonka ee milkiilaha")

    try:
        car_model = SuspectCarModal.objects.get(pk=data.get("car_model"))
        suspect = Suspect.objects.get(pk=data.get("suspect"))
    except (SuspectCarModal.DoesNotExist, Suspect.DoesNotExist):
        return legacy_validation("Invalid car model or suspect ID")

    if data.get("ownership") == "Yes":
        ownername = suspect.name
        ownerphone = suspect.phone or ""
    else:
        ownername = data.get("ownername")
        ownerphone = str(data.get("ownerphone"))

    photo = coerce_picture_upload(photo_file)
    today = datetime.today()
    recorded_by_id = data.get("user_id") or request.user.pk
    car_source = (
        SuspectCar.Source.BAARIS
        if getattr(suspect, "source", "") == Suspect.Source.BAARIS
        else SuspectCar.Source.AMNIGA
    )
    car = SuspectCar.objects.create(
        car_model=car_model,
        plate_number=data.get("plate_number"),
        suspect=suspect,
        source=car_source,
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        description=data.get("description"),
        ownership=data.get("ownership"),
        ownername=ownername,
        ownerphone=ownerphone,
        picture=photo,
        recorded_by_id=recorded_by_id,
        date_opp=today.date(),
        day=today.strftime("%d"),
        month=today.strftime("%m"),
        year=today.strftime("%Y"),
    )
    label = car_model.name or "Gaari"
    return Response(legacy_success(f"{label} is successfully registered"))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def suspect_car_list(request):
    filter_date = request.GET.get("dateFilter")
    page_number = int(request.data.get("page", 1) or 1)
    search_query = (request.data.get("searchFilter") or "").strip()
    suspect_id = request.data.get("suspect_id")

    qs = SuspectCar.objects.select_related(
        "car_model", "suspect", "suspect__suspect_type", "suspect__capture_county", "recorded_by__county"
    ).order_by("-created_at")

    if suspect_id not in (None, ""):
        try:
            qs = qs.filter(suspect_id=int(suspect_id))
        except (TypeError, ValueError):
            return legacy_validation("suspect_id waa inuu noqdaa lambar sax ah")

    if filter_date:
        qs = qs.filter(date_opp=filter_date)
    if search_query:
        qs = qs.filter(
            Q(plate_number__icontains=search_query)
            | Q(ownername__icontains=search_query)
            | Q(ownerphone__icontains=search_query)
            | Q(description__icontains=search_query)
            | Q(suspect__name__icontains=search_query)
        )

    paginator = Paginator(qs, 10)
    page = paginator.get_page(page_number)
    message = []
    for car in page.object_list:
        suspect = car.suspect
        driver_name = car.ownername
        st = "Shaki"
        degmo = "Unknown"
        suspect_id = None
        if suspect:
            suspect_id = suspect.id
            driver_name = suspect.name
            st = suspect.suspect_type.name if suspect.suspect_type else "Unknown"
            degmo = suspect.capture_county.name if suspect.capture_county else "Unknown"
        elif car.recorded_by and car.recorded_by.county:
            degmo = car.recorded_by.county.name

        message.append(
            {
                "id": car.id,
                "driver_id": suspect_id,
                "car_model": car.old_car_model if not car.car_model else car.car_model.name,
                "driver_name": driver_name,
                "ownername": car.ownername,
                "ownerphone": car.ownerphone,
                "ownership": car.ownership,
                "status": st,
                "degmo": degmo,
                "plate_number": car.plate_number,
                "latitude": car.latitude,
                "longitude": car.longitude,
                "description": car.description,
                "created_at": car.created_at,
                "modified_at": car.modified_at,
                "photo": _car_photo_url(car, request),
                "recorded_by": car.recorded_by_id,
                "date_opp": car.date_opp,
                "day": car.day,
                "month": car.month,
                "year": car.year,
            }
        )

    return Response(
        {
            "Message": message,
            "total_pages": paginator.num_pages,
            "current_page": page_number,
            "isError": False,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def create_report(request):
    report_name = request.data.get("name")
    description = request.data.get("description")
    if is_clear(report_name):
        return legacy_validation("Please state the name of the report")
    if is_clear(description):
        return legacy_validation("Fill the description")

    if MobileTask.objects.filter(name=report_name, description=description).exists():
        return legacy_validation("You have already reported this data")

    picture = request.FILES.get("picture") or request.data.get("picture")
    if picture and not hasattr(picture, "read"):
        picture = coerce_picture_upload(picture)

    now = timezone.now()
    MobileTask.objects.create(
        name=report_name,
        description=description,
        user=request.user,
        picture=picture,
        date_opp=now.date(),
        is_seen=False,
        day=str(now.day),
        month=str(now.month),
        year=str(now.year),
    )
    return Response(legacy_success(f"{report_name} is successfully created"))


@api_view(["PUT"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def update_report(request, id):
    try:
        report = MobileTask.objects.get(pk=id)
    except MobileTask.DoesNotExist:
        return legacy_validation("This report does not exist")

    if report.is_seen:
        return Response(
            {
                "message": f"Isku day inaad wax ka beddesho warbixinta Inta aan La arkin ({report.name}).",
                "isError": True,
            },
            status=400,
        )

    name = request.data.get("name")
    description = request.data.get("description")
    picture = request.FILES.get("picture")
    if name:
        report.name = name
    if description:
        report.description = description
    if picture:
        report.picture = picture
    report.save()
    return Response(legacy_success(f"Report '{report.name}' has been successfully updated."))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def report_list_all(request):
    filter_date = request.GET.get("dateFilter", "")
    page_number = int(request.data.get("page", 1) or 1)
    search_query = (request.GET.get("searchFilter") or "").strip()

    perm = user_permission_label(request.user).lower()
    if perm in ("dev", "general"):
        qs = MobileTask.objects.all()
    else:
        qs = MobileTask.objects.filter(user=request.user)

    if filter_date:
        qs = qs.filter(date_opp=filter_date)
    if search_query:
        qs = qs.filter(name__icontains=search_query)

    qs = qs.select_related("user").order_by("-created_at")
    paginator = Paginator(qs, 10)
    page = paginator.get_page(page_number)
    message = [
        {
            "id": t.id,
            "name": t.name,
            "picture": _task_photo_url(t, request),
            "description": t.description,
            "userka": t.user.get_full_name() if t.user else "",
            "tariikhda": t.date_opp,
            "status": t.is_seen,
        }
        for t in page.object_list
    ]
    return Response(
        {
            "Message": message,
            "total_pages": paginator.num_pages,
            "current_page": page_number,
            "isError": False,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def cabasho_list(request):
    rows = (
        CabashadaAppka.objects.select_related("user")
        .order_by("-created_at")
        .only("id", "type", "description", "is_seen", "created_at", "user")
    )
    message = [
        {
            "id": c.id,
            "type": c.type,
            "description": c.description,
            "userka": c.user.get_full_name() if c.user else "",
            "tariikhda": c.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "status": c.is_seen,
        }
        for c in rows
    ]
    return Response({"Message": message, "isError": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def create_cabashada_appka(request):
    type_of = request.data.get("type")
    description = request.data.get("description")
    user_id = request.data.get("user_id")
    if not type_of:
        return Response({"message": "Nooca cabashada waa qasab in la galiyo"}, status=400)
    if not description:
        return Response({"message": "Faahfaahinta cabashada waa qasab in la galiyo"}, status=400)
    user = User.objects.get(pk=int(user_id))
    CabashadaAppka.objects.create(type=type_of, description=description, user=user)
    return Response({"message": "Cabashada waa la diiwaangeliyay", "isError": False})


@api_view(["PUT"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def update_cabashada_appka(request, id):
    complaint = CabashadaAppka.objects.get(pk=id)
    if complaint.is_seen:
        return legacy_validation("This complaint has already been addressed and cannot be updated")
    type_of = (request.data.get("type") or "").strip()
    description = (request.data.get("description") or "").strip()
    if not type_of or not description:
        return legacy_validation("Please provide type and description")
    complaint.type = type_of
    complaint.description = description
    complaint.save(update_fields=["type", "description", "modified_at"])
    return Response(legacy_success("Complaint updated"))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def get_documents(request):
    tag = request.data.get("tag")
    if not tag:
        return Response({"Message": "Tag is required", "isError": True})
    return Response({"Message": cached_documents_by_tag(tag), "isError": False})


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def wanted_list_api(request):
    page = int(request.GET.get("page", 1))
    page_size = int(request.GET.get("page_size", 10))
    search = (request.GET.get("search") or "").strip()

    qs = WantedPerson.objects.select_related("citizenship", "wanted_type").order_by("-date_recorded")
    if search:
        from apps.suspects.face_service import phone_lookup_variants

        phone_variants = phone_lookup_variants(search)
        text_q = (
            Q(full_name__icontains=search)
            | Q(mother_name__icontains=search)
            | Q(gender__icontains=search)
            | Q(wanted_status__icontains=search)
            | Q(priority__icontains=search)
            | Q(details__icontains=search)
            | Q(phone__icontains=search)
        )
        if phone_variants:
            phone_q = Q(phone__in=phone_variants)
            for variant in phone_variants:
                phone_q |= Q(phone__icontains=variant)
            qs = qs.filter(text_q | phone_q)
        else:
            qs = qs.filter(text_q)

    paginator = Paginator(qs, page_size)
    page_obj = paginator.get_page(page)
    results = [
        {
            "id": str(w.id),
            "full_name": w.full_name,
            "gender": w.gender,
            "phone": getattr(w, "phone", "") or "",
            "mother_name": getattr(w, "mother_name", "") or "",
            "citizenship": w.citizenship.name if w.citizenship else None,
            "wanted_type": w.wanted_type.name if w.wanted_type else None,
            "wanted_status": w.wanted_status,
            "priority": w.priority,
            "details": w.details,
            "photo_url": resolve_photo_url(w.photo.name, request) if w.photo else None,
            "date_recorded": w.date_recorded.strftime("%Y-%m-%d %H:%M:%S"),
            "source": "wanted",
        }
        for w in page_obj.object_list
    ]
    return Response(
        {
            "status": True,
            "message": "Wanted list retrieved successfully",
            "data": {
                "results": results,
                "pagination": {
                    "current_page": page_obj.number,
                    "total_pages": paginator.num_pages,
                    "total_count": paginator.count,
                    "has_next": page_obj.has_next(),
                    "has_previous": page_obj.has_previous(),
                    "next_page": page_obj.next_page_number() if page_obj.has_next() else None,
                    "previous_page": page_obj.previous_page_number()
                    if page_obj.has_previous()
                    else None,
                },
            },
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def wanted_detail_api(request):
    wanted_id = request.data.get("wanted_id")
    if not wanted_id:
        return Response(
            {"status": False, "message": "wanted_id is required in request body", "data": None},
            status=400,
        )
    w = WantedPerson.objects.select_related("citizenship", "wanted_type").get(pk=wanted_id)
    data = {
        "id": str(w.id),
        "full_name": w.full_name,
        "gender": w.gender,
        "citizenship": w.citizenship.name if w.citizenship else None,
        "wanted_type": w.wanted_type.name if w.wanted_type else None,
        "wanted_status": w.wanted_status,
        "priority": w.priority,
        "details": w.details,
        "photo_url": resolve_photo_url(w.photo.name, request) if w.photo else "",
    }
    return Response({"status": True, "message": "Wanted detail retrieved", "data": data})


# --- Admin mobile endpoints ---


def _require_dev_admin(user):
    ut = getattr(user, "user_type", None)
    if user.is_superuser:
        return None
    if ut and (ut.name or "").lower() == "dev":
        return None
    return legacy_validation("Ma Haysatid Ogalaansho")


def _legacy_http_error(text: str, *, status_code: int, title: str = "Error"):
    return Response(
        {
            "isError": True,
            "title": title,
            "type": "error",
            "Message": text,
        },
        status=status_code,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def app_installation_departments(request):
    denied = _require_dev_admin(request.user)
    if denied:
        return denied
    departments = Department.objects.prefetch_related("counties").order_by("name")
    message = [
        {
            "id": department.id,
            "name": department.name,
            "counties": [
                {"id": county.id, "name": county.name}
                for county in department.counties.all().order_by("name")
            ],
        }
        for department in departments
    ]
    return Response({"Message": message, "isError": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def app_installation_users(request):
    denied = _require_dev_admin(request.user)
    if denied:
        return denied

    try:
        department_id = int(request.data.get("department_id") or 0)
        county_id = int(request.data.get("county_id") or 0)
    except (TypeError, ValueError):
        return legacy_validation("Qeyb iyo degmo waa inay tiro yihiin.")

    search = (request.data.get("searchQuery") or "").strip()
    status_filter = (request.data.get("installation_status") or "all").strip().lower()
    reason_filter = (request.data.get("not_installed_reason") or "all").strip().lower()
    page_number = int(request.data.get("page", 1) or 1)

    # Scope:
    # - department>0 + county>0 → one county (must belong to department)
    # - department>0 + county=0 → all counties in that department
    # - department=0 + county=0 → all agents (requires searchQuery len >= 2)
    # - department=0 + county>0 → rejected
    county_ids: list[int] | None = None
    if department_id > 0 and county_id > 0:
        department = Department.objects.prefetch_related("counties").get(
            pk=department_id
        )
        if not department.counties.filter(pk=county_id).exists():
            return legacy_validation("Degmadan kuma jirto qeybta la doortay.")
        county_ids = [county_id]
    elif department_id > 0 and county_id == 0:
        department = Department.objects.prefetch_related("counties").get(
            pk=department_id
        )
        county_ids = list(department.counties.values_list("id", flat=True))
        if not county_ids:
            return Response(
                {
                    "Message": [],
                    "summary": {
                        "total": 0,
                        "installed": 0,
                        "completed": 0,
                        "iphone": 0,
                        "not_installed": 0,
                    },
                    "total_pages": 1,
                    "current_page": 1,
                    "reason_options": [
                        {"value": value, "label": label}
                        for value, label in AgentAppInstallation.NotInstalledReason.choices
                    ],
                    "isError": False,
                }
            )
    elif department_id == 0 and county_id == 0:
        if len(search) < 2:
            return legacy_validation(
                "Raadin dhammaan agents-ka waxay u baahan tahay ugu yaraan 2 xaraf."
            )
        county_ids = None
    else:
        return legacy_validation(
            "Dooro qeyb marka hore, ama dooro dhammaan (qeyb=0 iyo degmo=0)."
        )

    last_login_subq = (
        AuditTrail.objects.filter(
            user_id=OuterRef("pk"),
            action__startswith=APP_LOGIN_ACTION,
        )
        .order_by("-created_at")
        .values("created_at")[:1]
    )
    qs = (
        User.objects.filter(is_superuser=False, is_agent=True)
        .select_related("county", "agent_profile", "app_installation")
        .prefetch_related("groups")
        .annotate(last_app_login=Subquery(last_login_subq))
        .order_by("id")
    )
    if county_ids is not None:
        qs = qs.filter(county_id__in=county_ids)
    if search:
        from apps.suspects.face_service import phone_lookup_variants

        digits = "".join(ch for ch in search if ch.isdigit())
        is_last_four = len(search) == 4 and search.isdigit()
        if is_last_four:
            # Four digits mean the tail of the employee number only (nickname).
            # service_id is a short internal code and must not participate.
            qs = qs.filter(agent_profile__nickname__endswith=search).distinct()
        else:
            search_q = (
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(agent_profile__service_id__icontains=search)
                | Q(agent_profile__nickname__icontains=search)
            )
            # Phones only match in full, so a partial number never widens results.
            phone_variants = phone_lookup_variants(search) if digits else []
            if phone_variants:
                search_q |= Q(phone__in=phone_variants) | Q(
                    agent_profile__phone__in=phone_variants
                )
            elif digits:
                search_q |= Q(phone__iexact=search) | Q(
                    agent_profile__phone__iexact=search
                )
            qs = qs.filter(search_q).distinct()

    total = qs.count()
    completed_count = qs.filter(
        app_installation__status=AgentAppInstallation.Status.COMPLETED
    ).count()
    iphone_count = qs.filter(
        app_installation__status=AgentAppInstallation.Status.IPHONE
    ).count()
    not_installed_count = total - completed_count - iphone_count
    if status_filter in {"installed", "completed"}:
        qs = qs.filter(
            app_installation__status=AgentAppInstallation.Status.COMPLETED
        )
    elif status_filter == "iphone":
        qs = qs.filter(app_installation__status=AgentAppInstallation.Status.IPHONE)
    elif status_filter == "not_installed":
        qs = qs.exclude(
            app_installation__status__in=[
                AgentAppInstallation.Status.COMPLETED,
                AgentAppInstallation.Status.IPHONE,
            ]
        )
    valid_reasons = {
        value for value, _label in AgentAppInstallation.NotInstalledReason.choices
    }
    if reason_filter in valid_reasons:
        qs = qs.filter(
            app_installation__status=AgentAppInstallation.Status.NOT_INSTALLED,
            app_installation__not_installed_reason=reason_filter,
        )

    paginator = Paginator(qs, 20)
    page = paginator.get_page(page_number)
    message = []
    for user in page.object_list:
        try:
            installation = user.app_installation
        except AgentAppInstallation.DoesNotExist:
            installation = None
        installation_status = (
            installation.status
            if installation
            else AgentAppInstallation.Status.NOT_INSTALLED
        )
        agent = getattr(user, "agent_profile", None)
        employee_number = ""
        if agent is not None:
            # nickname holds the employee number agents know and log in with;
            # service_id is only a short internal code.
            employee_number = agent.nickname or agent.service_id or ""
        message.append(
            {
                "id": user.id,
                "username": user.get_full_name() or user.username,
                # Agents sign in with email (e.g. magac@240968123.com), not the raw username code.
                "login_username": (user.email or user.username or "").strip(),
                "phone": user.phone or "",
                "email": user.email or "",
                "county": user.county.name if user.county else "",
                "employee_number": employee_number,
                "is_active": user.is_active,
                "lastlogin": format_user_lastlogin(user.last_app_login),
                "groups": [
                    {"id": group.id, "name": group.name}
                    for group in user.groups.all()
                ],
                "app_installed": (
                    installation_status == AgentAppInstallation.Status.COMPLETED
                ),
                "installation_status": installation_status,
                "installation_label": dict(
                    AgentAppInstallation.Status.choices
                )[installation_status],
                "not_installed_reason": (
                    installation.not_installed_reason if installation else ""
                ),
                "not_installed_reason_label": (
                    installation.get_not_installed_reason_display()
                    if installation and installation.not_installed_reason
                    else ""
                ),
                "not_installed_reason_detail": (
                    installation.not_installed_reason_detail if installation else ""
                ),
                "installed_at": (
                    installation.installed_at.isoformat()
                    if installation and installation.installed_at
                    else None
                ),
            }
        )
    return Response(
        {
            "Message": message,
            "summary": {
                "total": total,
                # Keep installed for older clients; it is identical to completed.
                "installed": completed_count,
                "completed": completed_count,
                "iphone": iphone_count,
                "not_installed": not_installed_count,
            },
            "total_pages": paginator.num_pages,
            "current_page": page.number,
            "reason_options": [
                {"value": value, "label": label}
                for value, label in AgentAppInstallation.NotInstalledReason.choices
            ],
            "isError": False,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def update_app_installation(request):
    denied = _require_dev_admin(request.user)
    if denied:
        return denied

    user_id = request.data.get("user_id")
    checklist_status = request.data.get("status")
    installed = request.data.get("installed")
    reason = str(request.data.get("not_installed_reason") or "").strip().lower()
    reason_detail = str(
        request.data.get("not_installed_reason_detail") or ""
    ).strip()
    if user_id is None or (checklist_status is None and installed is None):
        return legacy_validation("user_id iyo status waa lagama maarmaan.")
    target = User.objects.get(pk=int(user_id), is_agent=True, is_superuser=False)
    if checklist_status is None:
        if isinstance(installed, str):
            installed_value = installed.strip().lower() in {"1", "true", "yes", "on"}
        else:
            installed_value = bool(installed)
        checklist_status = (
            AgentAppInstallation.Status.COMPLETED
            if installed_value
            else AgentAppInstallation.Status.NOT_INSTALLED
        )
    checklist_status = str(checklist_status).strip().lower()
    if checklist_status == "installed":
        checklist_status = AgentAppInstallation.Status.COMPLETED
    valid_statuses = {choice[0] for choice in AgentAppInstallation.Status.choices}
    if checklist_status not in valid_statuses:
        return legacy_validation("Status-ku waa not_installed, completed, ama iphone.")
    valid_reasons = {
        choice[0] for choice in AgentAppInstallation.NotInstalledReason.choices
    }
    if reason and reason not in valid_reasons:
        return legacy_validation("Sababta Looguma shubin sax ma aha.")
    if reason_detail and reason != AgentAppInstallation.NotInstalledReason.OTHER:
        reason_detail = ""
    if checklist_status != AgentAppInstallation.Status.NOT_INSTALLED:
        reason = ""
        reason_detail = ""

    record, _ = AgentAppInstallation.objects.get_or_create(user=target)
    is_completed = checklist_status == AgentAppInstallation.Status.COMPLETED
    record.status = checklist_status
    record.installed = is_completed
    record.installed_at = (
        record.installed_at or timezone.now()
        if is_completed
        else None
    )
    record.not_installed_reason = reason
    record.not_installed_reason_detail = reason_detail
    record.save(
        update_fields=[
            "status",
            "installed",
            "installed_at",
            "not_installed_reason",
            "not_installed_reason_detail",
            "updated_at",
        ]
    )
    return Response(
        {
            "Message": {
                "user_id": target.id,
                "app_installed": record.installed,
                "installation_status": record.status,
                "installation_label": record.get_status_display(),
                "not_installed_reason": record.not_installed_reason,
                "not_installed_reason_label": (
                    record.get_not_installed_reason_display()
                    if record.not_installed_reason
                    else ""
                ),
                "not_installed_reason_detail": record.not_installed_reason_detail,
                "installed_at": (
                    record.installed_at.isoformat() if record.installed_at else None
                ),
            },
            "isError": False,
        }
    )


_PERIOD_KEYS = ("all", "daily", "weekly", "monthly")


def _empty_period_counts() -> dict[str, int]:
    return {key: 0 for key in _PERIOD_KEYS}


def _county_user_totals(county_ids: list[int]) -> dict[int, int]:
    """Total users per degmo (county_id) — not filtered by period."""
    totals = {cid: 0 for cid in county_ids}
    rows = (
        User.objects.filter(county_id__in=county_ids)
        .values("county_id")
        .annotate(c=Count("pk"))
    )
    for row in rows:
        cid = row["county_id"]
        if cid is not None:
            totals[cid] = row["c"]
    return totals


def _county_period_count_maps(county_ids: list[int]) -> tuple[dict[int, int], dict, dict]:
    """Per-county suspect/case counts by period; users are totals only (see _county_user_totals)."""
    today = timezone.localdate()
    week_start = today - timedelta(days=6)
    month_start = today - timedelta(days=29)

    def _group_counts(model, county_key: str, date_key: str) -> dict[int, dict[str, int]]:
        base = {cid: _empty_period_counts() for cid in county_ids}
        rows = (
            model.objects.filter(**{f"{county_key}__in": county_ids})
            .values(county_key)
            .annotate(
                all_c=Count("pk"),
                daily_c=Count("pk", filter=Q(**{f"{date_key}__date": today})),
                weekly_c=Count("pk", filter=Q(**{f"{date_key}__date__gte": week_start})),
                monthly_c=Count("pk", filter=Q(**{f"{date_key}__date__gte": month_start})),
            )
        )
        for row in rows:
            cid = row[county_key]
            if cid is None:
                continue
            base[cid] = {
                "all": row["all_c"],
                "daily": row["daily_c"],
                "weekly": row["weekly_c"],
                "monthly": row["monthly_c"],
            }
        return base

    users = _county_user_totals(county_ids)
    suspects = _group_counts(Suspect, "created_by__county_id", "created_at")
    cases = _group_counts(SuspectCase, "capture_county_id", "created_at")
    return users, suspects, cases


def _period_bucket(
    user_total: int,
    suspects_map: dict,
    cases_map: dict,
    county_id: int,
    period: str,
) -> dict[str, int]:
    return {
        "users": user_total,
        "suspects": suspects_map.get(county_id, {}).get(period, 0),
        "cases": cases_map.get(county_id, {}).get(period, 0),
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def top_admin_page(request):
    denied = _require_dev_admin(request.user)
    if denied:
        return denied

    user_id = request.data.get("user_id")
    page_number = int(request.data.get("page", 1) or 1)
    actor = User.objects.select_related("user_type", "county").get(pk=int(user_id))

    if user_permission_label(actor) in ("General", "Dev"):
        counties = County.objects.all().order_by("name")
    else:
        counties = County.objects.filter(pk=actor.county_id).order_by("name")

    paginator = Paginator(counties, 10)
    page = paginator.get_page(page_number)
    county_ids = [c.id for c in page.object_list]

    user_totals, suspects_map, cases_map = _county_period_count_maps(county_ids)

    message = [
        {
            "id": county.id,
            "name": county.name,
            "img": resolve_photo_url(county.image, request) if county.image else None,
            "user": user_id,
            "user_county": user_totals.get(county.id, 0),
            "total_suspect": suspects_map.get(county.id, {}).get("all", 0),
            "total_cases": cases_map.get(county.id, {}).get("all", 0),
            "daily": _period_bucket(user_totals.get(county.id, 0), suspects_map, cases_map, county.id, "daily"),
            "weekly": _period_bucket(user_totals.get(county.id, 0), suspects_map, cases_map, county.id, "weekly"),
            "monthly": _period_bucket(user_totals.get(county.id, 0), suspects_map, cases_map, county.id, "monthly"),
            "all": _period_bucket(user_totals.get(county.id, 0), suspects_map, cases_map, county.id, "all"),
        }
        for county in page.object_list
    ]
    return Response(
        {
            "Message": message,
            "total_pages": paginator.num_pages,
            "current_page": page_number,
            "isError": False,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def top_user(request):
    rows = (
        User.objects.select_related("county")
        .annotate(num_suspects=Count("registered_suspects"))
        .order_by("-num_suspects")[:20]
    )
    message = [
        {
            "id": u.id,
            "name": u.get_full_name(),
            "county": u.county.name if u.county else None,
            "s_count": u.num_suspects,
        }
        for u in rows
    ]
    return Response({"Message": message, "isError": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def county_user_data(request):
    county_id = request.data.get("county_id")
    last_login_subq = (
        AuditTrail.objects.filter(
            user_id=OuterRef("pk"),
            action__startswith=APP_LOGIN_ACTION,
        )
        .order_by("-created_at")
        .values("created_at")[:1]
    )
    users = (
        User.objects.filter(county_id=county_id)
        .annotate(
            total_suspect=Count("registered_suspects"),
            last_app_login=Subquery(last_login_subq),
        )
        .order_by("id")
    )
    message = [
        {
            "id": u.id,
            "name": u.get_full_name(),
            "phone": u.phone or "",
            "email": u.email or "",
            "total_suspect": u.total_suspect,
            "lastlogin": format_user_lastlogin(u.last_app_login),
            "last_login_at": serialize_last_login_at(u.last_app_login),
        }
        for u in users
    ]
    return Response({"Message": message, "isError": False})


def _parse_coord(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def user_management(request):
    is_dev_admin = _require_dev_admin(request.user) is None
    commander_all = is_taliye_all(request.user)
    commander_qeyb = is_taliye_qebeed(request.user)
    qeyb_ids = qeyb_county_ids(request.user) if commander_qeyb else []
    caller_county_id = getattr(request.user, "county_id", None)

    if not is_dev_admin and not commander_all and not commander_qeyb and not caller_county_id:
        page_number = int(request.data.get("page", 1) or 1)
        return Response(
            {
                "Message": [],
                "total_pages": 0,
                "current_page": page_number,
                "isError": False,
            }
        )

    county = request.data.get("county", "")
    search_query = (request.data.get("searchQuery") or "").strip()
    page_number = int(request.data.get("page", 1) or 1)
    my_lat = _parse_coord(request.data.get("latitude") or request.data.get("lat"))
    my_lng = _parse_coord(request.data.get("longitude") or request.data.get("lng"))
    county_scoped = bool(county and str(county) not in ("0", ""))
    # Rank by GPS whenever the client sends coords (walkie / nearby), even without a county filter.
    sort_by_distance = my_lat is not None and my_lng is not None
    max_km = _parse_coord(request.data.get("max_distance_km") or request.data.get("max_km"))
    if max_km is not None and max_km <= 0:
        max_km = None

    qs = User.objects.filter(is_superuser=False).select_related("county")
    if is_dev_admin:
        if county_scoped:
            qs = qs.filter(county_id=county)
    else:
        qs = qs.filter(
            is_agent=True,
            is_active=True,
            suspend=False,
        ).exclude(pk=request.user.pk)
        if commander_all:
            if county_scoped:
                qs = qs.filter(county_id=county)
        elif commander_qeyb:
            if not qeyb_ids:
                qs = qs.none()
            elif county_scoped and str(county).isdigit() and int(county) in qeyb_ids:
                qs = qs.filter(county_id=int(county))
            else:
                qs = qs.filter(county_id__in=qeyb_ids)
        else:
            qs = qs.filter(county_id=caller_county_id)

    if search_query:
        qs = qs.filter(
            Q(first_name__icontains=search_query)
            | Q(last_name__icontains=search_query)
            | Q(username__icontains=search_query)
            | Q(phone__icontains=search_query)
            | Q(email__icontains=search_query)
        )

    last_login_subq = (
        AuditTrail.objects.filter(
            user_id=OuterRef("pk"),
            action__startswith=APP_LOGIN_ACTION,
        )
        .order_by("-created_at")
        .values("created_at")[:1]
    )
    qs = qs.annotate(last_app_login=Subquery(last_login_subq))

    if sort_by_distance:
        # CharField coords → nullable floats; order by squared euclidean (enough for ranking).
        # Only cast numeric strings — legacy rows use "N/A" and Cast() would 500 the whole page.
        coord_re = r"^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$"
        qs = qs.annotate(
            _lat=Case(
                When(
                    latitude__regex=coord_re,
                    then=Cast(NullIf(F("latitude"), Value("")), FloatField()),
                ),
                default=Value(None),
                output_field=FloatField(),
            ),
            _lng=Case(
                When(
                    longitude__regex=coord_re,
                    then=Cast(NullIf(F("longitude"), Value("")), FloatField()),
                ),
                default=Value(None),
                output_field=FloatField(),
            ),
        ).annotate(
            dist_sq=Case(
                When(_lat__isnull=True, then=Value(None)),
                When(_lng__isnull=True, then=Value(None)),
                default=Power(F("_lat") - my_lat, 2) + Power(F("_lng") - my_lng, 2),
                output_field=FloatField(),
            )
        )
        if max_km is not None:
            # Bounding box (~111 km per degree lat). Exact haversine still applied below.
            dlat = max_km / 111.0
            cos_lat = max(0.2, abs(math.cos(math.radians(my_lat))))
            dlng = max_km / (111.0 * cos_lat)
            qs = qs.filter(
                _lat__isnull=False,
                _lng__isnull=False,
                _lat__gte=my_lat - dlat,
                _lat__lte=my_lat + dlat,
                _lng__gte=my_lng - dlng,
                _lng__lte=my_lng + dlng,
            )
        qs = qs.order_by(F("dist_sq").asc(nulls_last=True), "id")
    else:
        qs = qs.order_by("id")

    paginator = Paginator(qs, 10)
    page = paginator.get_page(page_number)
    message = []
    for idx, u in enumerate(page.object_list):
        u_lat = _parse_coord(getattr(u, "latitude", None))
        u_lng = _parse_coord(getattr(u, "longitude", None))
        distance_km = None
        if (
            sort_by_distance
            and u_lat is not None
            and u_lng is not None
            and my_lat is not None
            and my_lng is not None
        ):
            distance_km = round(_haversine_km(my_lat, my_lng, u_lat, u_lng), 3)
            if max_km is not None and distance_km > max_km:
                continue
        is_closest = (
            sort_by_distance
            and page_number == 1
            and len(message) == 0
            and distance_km is not None
        )
        activity = activity_snapshot(u.last_app_login)
        message.append(
            {
                "id": u.id,
                "image": user_profile_url(u, request),
                "username": u.get_full_name(),
                "phone": u.phone,
                "county": u.county.name if u.county else None,
                "email": u.email,
                "date_joined": u.date_joined.strftime("%Y-%m-%d"),
                "is_active": u.is_active,
                "lastlogin": format_user_lastlogin(u.last_app_login),
                "last_login_at": serialize_last_login_at(u.last_app_login),
                "last_login_relative": relative_activity_label(u.last_app_login),
                "activity_status": activity["status"],
                "inactive_days": activity["inactive_days"],
                "latitude": u_lat,
                "longitude": u_lng,
                "distance_km": distance_km,
                "is_closest": is_closest,
            }
        )
    return Response(
        {
            "Message": message,
            "total_pages": paginator.num_pages,
            "current_page": page_number,
            "isError": False,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def update_user_status(request):
    user_id = request.data.get("user_id")
    new_status = request.data.get("is_active")
    if user_id is None or new_status is None:
        return Response({"error": "Please provide both 'user_id' and 'is_active' status"}, status=400)
    if int(new_status) not in (0, 1):
        return Response({"error": "Invalid value for 'is_active'. Must be '0' or '1'."}, status=400)
    user = User.objects.get(pk=int(user_id))
    user.is_active = bool(int(new_status))
    user.save(update_fields=["is_active"])
    return Response({"message": "User status updated successfully", "isError": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def bulk_update_user_status(request):
    user_ids = request.data.get("user_ids") or []
    new_status = request.data.get("is_active")
    if not user_ids or new_status is None:
        return Response({"error": "user_ids and is_active are required"}, status=400)
    active = bool(int(new_status))
    updated = User.objects.filter(pk__in=user_ids).update(is_active=active)
    return Response({"message": f"{updated} users updated", "isError": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def change_user_county(request):
    """Mobile User Management: move an agent to another county by user_id."""
    ut = getattr(request.user, "user_type", None)
    is_dev_admin = bool(
        request.user.is_superuser
        or (ut and (ut.name or "").lower() == "dev")
    )
    if not is_dev_admin:
        return _legacy_http_error(
            "Ma Haysatid Ogalaansho",
            status_code=status.HTTP_403_FORBIDDEN,
            title="Forbidden",
        )

    user_id = request.data.get("user_id")
    county_id = request.data.get("county_id")
    if user_id is None or county_id is None or user_id == "" or county_id == "":
        return _legacy_http_error(
            "user_id iyo county_id waa lagama maarmaan.",
            status_code=status.HTTP_400_BAD_REQUEST,
            title="Validation",
        )

    try:
        user_id = int(user_id)
        county_id = int(county_id)
    except (TypeError, ValueError):
        return _legacy_http_error(
            "user_id iyo county_id waa inay tiro yihiin.",
            status_code=status.HTTP_400_BAD_REQUEST,
            title="Validation",
        )

    try:
        target = User.objects.select_related("county", "agent_profile").get(pk=user_id)
    except User.DoesNotExist:
        return _legacy_http_error(
            "User-ka lama helin.",
            status_code=status.HTTP_404_NOT_FOUND,
            title="Not Found",
        )

    if target.is_superuser:
        return _legacy_http_error(
            "Superuser lama wareejin karo.",
            status_code=status.HTTP_403_FORBIDDEN,
            title="Forbidden",
        )

    try:
        county = County.objects.get(pk=county_id)
    except County.DoesNotExist:
        return _legacy_http_error(
            "Degmada lama helin.",
            status_code=status.HTTP_404_NOT_FOUND,
            title="Not Found",
        )

    old_county_name = target.county.name if target.county_id else ""
    target.county = county
    target.save(update_fields=["county"])

    agent = getattr(target, "agent_profile", None)
    if agent is not None:
        agent.county = county
        agent.save(update_fields=["county"])

    AuditService.log(
        request=request,
        user=request.user,
        action=(
            f"Changed user county for {target.email or target.username} "
            f"({old_county_name or 'None'} → {county.name})"
        ),
        event_type=AuditTrail.EventType.UPDATE,
        module="mobile",
        submodule="user-management",
        entity_type="user",
        entity_id=str(target.pk),
        details={
            "user_id": target.pk,
            "old_county_name": old_county_name,
            "county_id": county.pk,
            "county_name": county.name,
        },
        async_write=False,
    )

    return Response(
        {
            "Message": {
                "user_id": target.pk,
                "county_id": county.pk,
                "county_name": county.name,
                "old_county_name": old_county_name,
            },
            "isError": False,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
@legacy_catch
def reset_user_password(request):
    denied = _require_dev_admin(request.user)
    if denied:
        return denied
    user_id = request.data.get("user_id")
    if not user_id:
        return Response({"message": "user_id is required"}, status=400)
    target = User.objects.get(pk=int(user_id))
    if target.pk == request.user.pk:
        return Response({"message": "You cannot reset your own password"}, status=400)
    phone = (target.phone or "").strip()
    if not phone:
        return Response({"message": "User has no phone number for password reset"}, status=400)
    if phone.startswith("0"):
        phone = phone[1:]
    target.set_password(phone)
    target.password_changed = False
    target.save(update_fields=["password", "password_changed"])
    login_username = (target.email or target.username or "").strip()
    return Response(
        {
            "message": f"Password has been reset to the phone number for {login_username}",
            "Message": {
                "username": login_username,
                "password": phone,
                "email": target.email or "",
                "phone": target.phone or "",
            },
            "username": login_username,
            "password": phone,
            "email": target.email or "",
            "phone": target.phone or "",
            "isError": False,
        }
    )
