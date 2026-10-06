"""Shared, performance-tuned suspect querysets."""

from django.db.models import Q, QuerySet

from .models import Damiinada, Suspect, SuspectCase

LEGACY_LIST_LIMIT = 250

LIST_ONLY = (
    "id",
    "name",
    "alias",
    "mother_name",
    "phone",
    "photo_url",
    "district",
    "case_ref",
    "status",
    "risk",
    "is_released",
    "bail_count",
    "suspect_type_id",
    "capture_county_id",
    "last_seen",
    "date_of_birth",
    "offense",
    "source",
    "created_by_id",
    "created_at",
    "updated_at",
)

CASE_LIST_ONLY = (
    "id",
    "case_code",
    "suspect_id",
    "damiin_id",
    "tuhunka_id",
    "capture_county_id",
    "capture_sub_county_id",
    "description",
    "created_at",
)

DAMIIN_LIST_ONLY = (
    "id",
    "code",
    "name",
    "phone",
    "new_relationship_id",
    "relationship",
    "county_id",
    "sub_county_id",
    "occupation",
    "workplace",
    "description",
    "created_at",
)


def _apply_active_filter(qs: QuerySet[Suspect], *, include_released: bool) -> QuerySet[Suspect]:
    if include_released:
        return qs
    return qs.filter(is_released=False).exclude(status=Suspect.Status.CLEARED)


def _apply_search_filter(
    qs: QuerySet[Suspect],
    search: str,
    *,
    extended: bool = False,
    extra_ids: set[int] | None = None,
) -> QuerySet[Suspect]:
    if not search:
        return qs
    extra = Q(pk__in=extra_ids) if extra_ids else Q()
    if extended:
        return qs.filter(
            Q(name__icontains=search)
            | Q(alias__icontains=search)
            | Q(mother_name__icontains=search)
            | Q(phone__icontains=search)
            | Q(goobta_dhalashada__icontains=search)
            | Q(father_contact__icontains=search)
            | Q(mother_contact__icontains=search)
            | Q(occupation__icontains=search)
            | Q(suspect_type__name__icontains=search)
            | extra
        )
    return qs.filter(
        Q(name__icontains=search)
        | Q(alias__icontains=search)
        | Q(mother_name__icontains=search)
        | Q(phone__icontains=search)
        | Q(district__icontains=search)
        | Q(case_ref__icontains=search)
        | Q(offense__icontains=search)
        | extra
    )


def _apply_county_filter(qs: QuerySet[Suspect], county: str) -> QuerySet[Suspect]:
    if not county or county in ("", "0"):
        return qs
    from apps.accounts.models import County

    if str(county).isdigit():
        county_id = int(county)
        filters = (
            Q(capture_county_id=county_id)
            | Q(address_id=county_id)
        )
        county_name = County.objects.filter(pk=county_id).values_list("name", flat=True).first()
        if county_name:
            filters |= (
                Q(district__iexact=county_name)
                | Q(capture_county__name__iexact=county_name)
                | Q(address__name__iexact=county_name)
            )
        return qs.filter(filters)
    return qs.filter(
        Q(capture_county_id=county)
        | Q(address_id=county)
        | Q(district__iexact=county)
        | Q(address__name__iexact=county)
    )


def _apply_source_filter(qs: QuerySet[Suspect], source: str) -> QuerySet[Suspect]:
    """Optional registry partition. Empty source = shared (search/lookup)."""
    if not source:
        return qs
    return qs.filter(source=source)


def active_suspects_qs(*, district: str = "", search: str = "") -> QuerySet[Suspect]:
    qs = _apply_active_filter(
        Suspect.objects.only(*LIST_ONLY).order_by("-updated_at"),
        include_released=False,
    )
    # Amniga operational dashboards stay on criminal registry by default.
    qs = _apply_source_filter(qs, Suspect.Source.AMNIGA)
    if district:
        qs = qs.filter(district__iexact=district)
    return _apply_search_filter(qs, search)


def _apply_filter_date(qs: QuerySet[Suspect], filter_date: str) -> QuerySet[Suspect]:
    """Filter by registration calendar day in Africa/Mogadishu."""
    if not filter_date:
        return qs
    from datetime import date as date_cls
    from datetime import datetime, time
    from zoneinfo import ZoneInfo

    try:
        day = date_cls.fromisoformat(filter_date[:10])
    except ValueError:
        return qs
    mog = ZoneInfo("Africa/Mogadishu")
    start = datetime.combine(day, time.min, tzinfo=mog)
    end = datetime.combine(day, time.max, tzinfo=mog)
    return qs.filter(created_at__gte=start, created_at__lte=end)


def suspect_registry_qs(
    *,
    search: str = "",
    district: str = "",
    county: str = "",
    status: str = "",
    risk: str = "",
    suspect_type: str = "",
    filter_date: str = "",
    include_released: bool = False,
    source: str = "",
) -> QuerySet[Suspect]:
    qs = (
        Suspect.objects.select_related("suspect_type", "capture_county")
        .only(*LIST_ONLY, "suspect_type__name", "capture_county__name")
        .order_by("-updated_at")
    )
    qs = _apply_active_filter(qs, include_released=include_released)
    # Dashboard Amniga lists default to amniga; pass source="" only for shared search.
    qs = _apply_source_filter(qs, source if source != "" else Suspect.Source.AMNIGA)
    qs = _apply_search_filter(qs, search)
    qs = _apply_county_filter(qs, county)
    qs = _apply_filter_date(qs, filter_date)
    if district:
        qs = qs.filter(district__iexact=district)
    if status:
        qs = qs.filter(status=status)
    if risk:
        qs = qs.filter(risk=risk)
    if suspect_type:
        qs = qs.filter(suspect_type_id=suspect_type)
    return qs


def suspect_app_list_qs(
    *,
    search: str = "",
    county: str = "",
    filter_date: str = "",
    include_released: bool = False,
    source: str = "",
    extra_search_ids: set[int] | None = None,
) -> QuerySet[Suspect]:
    """App + web share this queryset — same active filter and sort order.

    source="" keeps search/lookup shared across registries.
    Pass source=amniga|baaris for role-scoped browse lists.
    """
    qs = (
        Suspect.objects.select_related(
            "suspect_type",
            "capture_county",
            "capture_sub_county",
            "address",
            "nationality",
            "created_by",
        )
        .order_by("-updated_at")
    )
    qs = _apply_active_filter(qs, include_released=include_released)
    qs = _apply_source_filter(qs, source)
    qs = _apply_search_filter(qs, search, extended=True, extra_ids=extra_search_ids)
    qs = _apply_county_filter(qs, county)
    qs = _apply_filter_date(qs, filter_date)
    return qs


def cases_for_suspect(suspect_id: int) -> QuerySet[SuspectCase]:
    return (
        SuspectCase.objects.filter(suspect_id=suspect_id)
        .select_related("tuhunka", "damiin", "capture_county", "capture_sub_county", "created_by")
        .only(
            *CASE_LIST_ONLY,
            "tuhunka__name",
            "damiin__name",
            "damiin__phone",
            "capture_county__name",
            "capture_sub_county__name",
            "created_by__username",
            "created_by__first_name",
            "created_by__last_name",
        )
        .order_by("-created_at")
    )


def damiin_for_suspect(suspect_id: int) -> QuerySet[Damiinada]:
    return (
        Damiinada.objects.filter(cases__suspect_id=suspect_id)
        .select_related("county", "sub_county", "new_relationship")
        .only(*DAMIIN_LIST_ONLY, "county__name", "sub_county__name", "new_relationship__relationship")
        .distinct()
        .order_by("-created_at")
    )
