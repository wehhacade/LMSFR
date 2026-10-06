"""Build old /APIs suspect list/detail dicts from a Suspect instance."""

from __future__ import annotations

from apps.mobile.helpers import get_modified_dates
from apps.suspects.models import Suspect, visible_bail_count
from apps.suspects.photo_utils import resolve_photo_url


def legacy_suspect_row(suspect: Suspect, *, request=None, user_id=None) -> dict:
    bail_count = getattr(suspect, "bail_count", None)
    if bail_count is None:
        bail_count = suspect.bail_count or suspect.cases.count()

    dob = suspect.date_of_birth
    created = suspect.created_at
    officer = suspect.created_by
    officer_name = ""
    if officer is not None:
        officer_name = (
            f"{getattr(officer, 'first_name', '')} {getattr(officer, 'last_name', '')}".strip()
            or getattr(officer, "username", "")
            or ""
        )
    return {
        "id": suspect.id,
        "name": suspect.name,
        "mother": suspect.mother_name or "",
        "nickname": suspect.alias or "",
        "N_tuhunka": suspect.suspect_type.name if suspect.suspect_type else None,
        "Dob": dob.isoformat() if dob else None,
        "g_dhalashada": suspect.goobta_dhalashada or "",
        "degmada": (
            suspect.capture_county.name
            if suspect.capture_county
            else (suspect.address.name if suspect.address else suspect.district or None)
        ),
        "marital": suspect.marriage_status or "",
        "children": suspect.children,
        "jailed": suspect.xabsi_waligaa_ma_soo_martay or "",
        "occupation": suspect.occupation or "",
        "description": suspect.notes or suspect.offense or "",
        "tnumber": suspect.phone or "",
        "father_contact": suspect.father_contact or "",
        "mother_contact": suspect.mother_contact or "",
        "captureTime": visible_bail_count(bail_count),
        "photo": resolve_photo_url(suspect.photo_url, request),
        "date_opp": (
            suspect.date_opp.isoformat()
            if suspect.date_opp
            else (suspect.created_at.date().isoformat() if suspect.created_at else None)
        ),
        "gender": suspect.gender or "",
        "user": suspect.created_by_id,
        "seen": True,
        "created_at": created.isoformat() if created else None,
        "created_ago": get_modified_dates(created) if created else "",
        "tribe": suspect.tribe or "",
        "lambarka_diiwaanka": suspect.lambarka_diiwaanka or "",
        "goobta_shaqada": suspect.goobta_shaqada or "",
        "nationality": suspect.nationality.name if suspect.nationality else None,
        "nationality_id": suspect.nationality_id,
        "is_released": suspect.is_released or suspect.status == Suspect.Status.CLEARED,
        "case_ref": suspect.case_ref,
        "status": suspect.status,
        "risk": suspect.risk,
        "sub_county": (
            suspect.capture_sub_county.name if suspect.capture_sub_county else None
        ),
        "source": getattr(suspect, "source", None) or Suspect.Source.AMNIGA,
        "registered_by": officer_name,
        "registered_by_id": suspect.created_by_id,
    }
