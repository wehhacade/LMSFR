"""Bridge the Wanted registry into legacy mobile suspect result rows.

The React Native app treats ``matches[].id`` as a Suspect primary key.  Wanted
has its own table and primary key, so every Wanted record is linked to a real
Suspect through ``suspect_identifier`` before it is exposed to mobile clients.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from django.db import transaction
from django.db.models import Q

from apps.suspects.legacy_suspect_row import legacy_suspect_row
from apps.suspects.models import Suspect, SuspectFaceEmbedding
from apps.suspects.photo_utils import resolve_photo_url


WANTED_LINK_PREFIX = "WANTED-"


def wanted_link_key(wanted_id: int) -> str:
    return f"{WANTED_LINK_PREFIX}{int(wanted_id)}"


def _wanted_photo_name(wanted) -> str:
    photo = getattr(wanted, "photo", None)
    if not photo:
        return ""
    try:
        return photo.name or ""
    except (AttributeError, ValueError):
        return ""


def _matching_existing_suspect(wanted) -> Suspect | None:
    """Prefer an already linked row, then the newest exact-phone identity."""
    link_key = wanted_link_key(wanted.pk)
    linked = (
        Suspect.objects.filter(Q(suspect_identifier=link_key) | Q(case_ref=link_key))
        .order_by("-id")
        .first()
    )
    if linked is not None:
        return linked

    from apps.suspects.face_service import phone_lookup_variants

    variants = phone_lookup_variants(wanted.phone or "")
    if not variants:
        return None
    return (
        Suspect.objects.filter(phone__in=variants)
        .filter(Q(suspect_identifier="") | Q(suspect_identifier=link_key))
        .order_by("-id")
        .first()
    )


@transaction.atomic
def ensure_wanted_suspect(wanted, *, embed_photo: bool = False) -> Suspect:
    """Return the stable Suspect identity used by all legacy mobile actions."""
    link_key = wanted_link_key(wanted.pk)
    suspect = _matching_existing_suspect(wanted)
    photo_name = _wanted_photo_name(wanted)
    wanted_type = wanted.wanted_type.name if wanted.wanted_type_id else "Wanted"

    if suspect is None:
        suspect = Suspect.objects.create(
            name=wanted.full_name or "",
            mother_name=wanted.mother_name or "",
            phone=wanted.phone or "",
            photo_url=photo_name,
            district="",
            case_ref=link_key,
            status=Suspect.Status.ACTIVE,
            risk=(wanted.priority or Suspect.Risk.HIGH).lower(),
            last_seen=date.today(),
            offense=wanted_type,
            notes=wanted.details or "",
            gender=wanted.gender or "",
            nationality_id=wanted.citizenship_id,
            created_by_id=wanted.created_by_id,
            source=Suspect.Source.AMNIGA,
            suspect_identifier=link_key,
        )
    else:
        changed: list[str] = []
        if suspect.suspect_identifier != link_key:
            suspect.suspect_identifier = link_key
            changed.append("suspect_identifier")
        is_wanted_shadow = suspect.case_ref == link_key
        # Keep generated Wanted shadows synchronized. For an established case,
        # only fill blanks so registry edits cannot overwrite case identity.
        for field, value in (
            ("name", wanted.full_name or ""),
            ("mother_name", wanted.mother_name or ""),
            ("phone", wanted.phone or ""),
            ("photo_url", photo_name),
            ("gender", wanted.gender or ""),
        ):
            if value and (is_wanted_shadow or not getattr(suspect, field)):
                if getattr(suspect, field) == value:
                    continue
                setattr(suspect, field, value)
                changed.append(field)
        if changed:
            changed.append("updated_at")
            suspect.save(update_fields=changed)

    if embed_photo and photo_name and not SuspectFaceEmbedding.objects.filter(suspect=suspect).exists():
        _store_wanted_photo_embedding(wanted, suspect)
    return suspect


@transaction.atomic
def unlink_wanted_suspect(wanted) -> None:
    """Remove only the Wanted link; preserve real suspects and existing cases."""
    link_key = wanted_link_key(wanted.pk)
    suspect = Suspect.objects.filter(suspect_identifier=link_key).first()
    if suspect is None:
        return
    if suspect.case_ref == link_key and not suspect.cases.exists():
        from apps.suspects.insightface import unenroll_suspect

        unenroll_suspect(suspect.pk)
        suspect.delete()
        return
    suspect.suspect_identifier = ""
    suspect.save(update_fields=["suspect_identifier", "updated_at"])


def _store_wanted_photo_embedding(wanted, suspect: Suspect) -> None:
    """Best-effort embedding using the exact same model and storage as suspects."""
    from apps.suspects.face_embedder import FaceEmbedError, embed_image_bytes
    from apps.suspects.face_service import store_suspect_embedding
    from apps.suspects.insightface import enroll_suspect_image, insightface_enabled

    try:
        wanted.photo.open("rb")
        image_bytes = wanted.photo.read()
        wanted.photo.close()
    except (AttributeError, OSError, ValueError):
        return
    if not image_bytes:
        return

    try:
        vector = embed_image_bytes(image_bytes)
        store_suspect_embedding(suspect_id=suspect.pk, vector=vector)
    except FaceEmbedError:
        pass

    if insightface_enabled():
        enroll_suspect_image(suspect.pk, image_bytes)


def ensure_all_wanted_suspects(*, embed_photos: bool = False) -> dict[int, Any]:
    """Synchronize Wanted identities and return them keyed by Suspect id."""
    from apps.mobile.models import WantedPerson

    wanted_by_suspect: dict[int, Any] = {}
    rows = WantedPerson.objects.select_related("citizenship", "wanted_type", "created_by")
    for wanted in rows.iterator():
        suspect = ensure_wanted_suspect(wanted, embed_photo=embed_photos)
        wanted_by_suspect[suspect.pk] = wanted
    return wanted_by_suspect


def wanted_mobile_row(wanted, suspect: Suspect, *, request=None) -> dict[str, Any]:
    """Build the literal row shape consumed by the existing RN mapper."""
    row = legacy_suspect_row(suspect, request=request)
    photo_name = _wanted_photo_name(wanted)
    row.update(
        {
            # Keep the registry PK separately; id must remain a Suspect PK.
            "id": suspect.pk,
            "wanted_id": wanted.pk,
            "name": wanted.full_name or row.get("name") or "",
            "mother": wanted.mother_name or row.get("mother") or "",
            "tnumber": wanted.phone or row.get("tnumber") or "",
            "photo": resolve_photo_url(photo_name, request) if photo_name else row.get("photo"),
            "N_tuhunka": wanted.wanted_type.name if wanted.wanted_type_id else "Wanted",
            "gender": wanted.gender or row.get("gender") or "",
            "description": wanted.details or row.get("description") or "",
            "source": "wanted",
            "status": "Wanted",
            "risk": wanted.priority or row.get("risk") or "high",
            "wanted_status": wanted.wanted_status or "Wanted",
        }
    )
    return row
