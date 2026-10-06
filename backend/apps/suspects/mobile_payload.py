"""Fast mobile payload builders — plain dicts, no DRF serializer overhead on lists."""

from __future__ import annotations

from typing import Any

from .photo_utils import resolve_photo_url
from .models import Damiinada, Suspect, SuspectCase, visible_bail_count
from .queries import active_suspects_qs, cases_for_suspect, damiin_for_suspect

MOBILE_PAGE_SIZE_DEFAULT = 40
MOBILE_PAGE_SIZE_MAX = 100


def _row_to_mobile_suspect(row: dict[str, Any], request=None) -> dict[str, Any]:
    name = row.get("name") or ""
    status = row.get("status") or ""
    return {
        "id": row["id"],
        "fullname": name,
        "nickname": row.get("alias") or "",
        "photo": resolve_photo_url(row.get("photo_url"), request),
        "district": row.get("district") or "",
        "status": status,
        "risk": row.get("risk") or "",
        "last_seen": str(row.get("last_seen") or ""),
        "offense": row.get("offense") or "",
        "case_ref": row.get("case_ref") or "",
        "is_released": status == Suspect.Status.CLEARED,
        "bail_count": visible_bail_count(row.get("bail_count")),
        "N_tuhunka": row.get("suspect_type__name"),
    }


def mobile_suspect_rows(*, district: str = "", search: str = "", page: int = 1, page_size: int = MOBILE_PAGE_SIZE_DEFAULT, request=None):
    page = max(1, page)
    page_size = min(max(1, page_size), MOBILE_PAGE_SIZE_MAX)
    qs = active_suspects_qs(district=district, search=search)
    total = qs.count()
    offset = (page - 1) * page_size
    rows = list(
        qs.values(
            "id",
            "name",
            "alias",
            "photo_url",
            "district",
            "case_ref",
            "status",
            "risk",
            "last_seen",
            "offense",
            "bail_count",
            "suspect_type__name",
        )[offset : offset + page_size]
    )
    results = [_row_to_mobile_suspect(r, request) for r in rows]
    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "has_more": offset + len(results) < total,
        "results": results,
    }


def mobile_suspect_detail(suspect_id: int, request=None) -> dict[str, Any] | None:
    row = (
        Suspect.objects.filter(pk=suspect_id)
        .values(
            "id",
            "name",
            "alias",
            "photo_url",
            "district",
            "case_ref",
            "status",
            "risk",
            "last_seen",
            "offense",
            "notes",
            "bail_count",
            "created_at",
            "updated_at",
            "suspect_type__name",
        )
        .first()
    )
    if not row:
        return None
    out = _row_to_mobile_suspect(row, request)
    out["notes"] = row.get("notes") or ""
    out["created_at"] = row["created_at"].isoformat() if row.get("created_at") else ""
    out["updated_at"] = row["updated_at"].isoformat() if row.get("updated_at") else ""
    return out


def mobile_case_rows(suspect_id: int) -> list[dict[str, Any]]:
    return [
        {
            "id": case.id,
            "case_code": case.case_code,
            "tuhunka": case.tuhunka.name if case.tuhunka else None,
            "d_qabashada": case.capture_county.name if case.capture_county else None,
            "w_qabashada": case.capture_sub_county.name if case.capture_sub_county else None,
            "damiin": case.damiin.name if case.damiin else None,
            "description": case.description,
        }
        for case in cases_for_suspect(suspect_id)
    ]


def mobile_guarantor_rows(suspect_id: int, request=None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for damiin in damiin_for_suspect(suspect_id):
        cases = [
            {
                "Tuhunka": case.tuhunka.name if case.tuhunka else None,
                "d_qabashada": case.capture_county.name if case.capture_county else None,
                "w_qabashada": case.capture_sub_county.name if case.capture_sub_county else None,
                "description": case.description,
            }
            for case in cases_for_suspect(suspect_id).filter(damiin_id=damiin.id)
        ]
        out.append(
            {
                "damiin_id": damiin.id,
                "id": damiin.id,
                "suspect": suspect_id,
                "name": damiin.name,
                "full_name": damiin.name,
                "phone": damiin.phone or "",
                "picture": resolve_photo_url(damiin.picture_url, request),
                "relationship": damiin.relationship or "",
                "relationship_id": damiin.new_relationship_id,
                "relationship_name": (
                    damiin.new_relationship.relationship if damiin.new_relationship else damiin.relationship or ""
                ),
                "degmada": damiin.county.name if damiin.county else None,
                "sub_county": damiin.sub_county.name if damiin.sub_county else None,
                "occupation": damiin.occupation or "",
                "goobta_shaqada": damiin.workplace or "",
                "description": damiin.description or "",
                "notes": damiin.description or "",
                "cases": cases,
                "created_at": damiin.created_at.isoformat() if damiin.created_at else "",
            }
        )
    return out


def mobile_damiin_cases(damiin_id: int) -> list[dict[str, Any]]:
    return [
        {
            "id": case.id,
            "tuhunka": case.tuhunka.name if case.tuhunka else None,
            "d_qabashada": case.capture_county.name if case.capture_county else None,
            "w_qabashada": case.capture_sub_county.name if case.capture_sub_county else None,
            "damiin": case.damiin.name if case.damiin else None,
            "description": case.description,
        }
        for case in (
            SuspectCase.objects.filter(damiin_id=damiin_id)
            .select_related("tuhunka", "damiin", "capture_county", "capture_sub_county")
            .order_by("-created_at")
        )
    ]


def mobile_damiin_info(damiin_id: int, request=None) -> dict[str, Any] | None:
    cases_qs = (
        SuspectCase.objects.filter(damiin_id=damiin_id)
        .select_related(
            "damiin",
            "damiin__county",
            "suspect",
            "tuhunka",
            "capture_county",
            "capture_sub_county",
        )
        .order_by("-created_at")
    )
    first = cases_qs.first()
    if not first or not first.damiin:
        damiin = Damiinada.objects.filter(pk=damiin_id).select_related("county").first()
        if not damiin:
            return None
        return {
            "Damiinada_id": damiin.id,
            "picture": resolve_photo_url(damiin.picture_url, request),
            "name": damiin.name,
            "phone": damiin.phone or "",
            "relationship": damiin.relationship or "",
            "degmada": damiin.county.name if damiin.county else None,
            "occupation": damiin.occupation or "",
            "goobta_shaqada": damiin.workplace or "",
            "suspects": [],
        }

    damiin = first.damiin
    suspects = []
    seen: set[int] = set()
    for case in cases_qs:
        if not case.suspect or case.suspect_id in seen:
            continue
        seen.add(case.suspect_id)
        suspects.append(
            {
                "suspect_id": case.suspect_id,
                "name": case.suspect.name,
                "picture": resolve_photo_url(case.suspect.photo_url, request) or None,
                "Tuhunka": case.tuhunka.name if case.tuhunka else None,
                "d_qabashada": case.capture_county.name if case.capture_county else None,
                "w_qabashada": case.capture_sub_county.name if case.capture_sub_county else None,
                "description": case.description,
            }
        )
    return {
        "Damiinada_id": damiin.id,
        "picture": resolve_photo_url(damiin.picture_url, request),
        "name": damiin.name,
        "phone": damiin.phone or "",
        "relationship": damiin.relationship or "",
        "degmada": damiin.county.name if damiin.county else None,
        "occupation": damiin.occupation or "",
        "goobta_shaqada": damiin.workplace or "",
        "suspects": suspects,
    }


def mobile_dhamaan_damiinada(*, search_query: str = "", county: str = "dhamaan") -> list[dict[str, Any]]:
    from django.db.models import Q

    qs = Damiinada.objects.select_related("county").order_by("-created_at")
    if county and county != "dhamaan":
        if str(county).isdigit():
            qs = qs.filter(county_id=int(county))
        else:
            qs = qs.filter(county_id=county)

    if search_query:
        qs = qs.filter(
            Q(phone__icontains=search_query)
            | Q(name__icontains=search_query)
            | Q(occupation__icontains=search_query)
            | Q(workplace__icontains=search_query)
        )

    return [
        {
            "id": row.id,
            "name": row.name,
            "degmada": row.county.name if row.county else None,
            "phone": row.phone or "",
        }
        for row in qs[:500]
    ]
