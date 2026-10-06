"""Map LMSBR suspects onto the InsightFace suspects collection."""

from __future__ import annotations

import logging
import threading
from typing import Any

from django.conf import settings

from apps.suspects.insightface.client import (
    InsightFaceError,
    add_faces,
    collection_id,
    configured,
    create_person,
    delete_person,
    ensure_collection,
    get_person,
    search,
)
from apps.suspects.legacy_suspect_row import legacy_suspect_row
from apps.suspects.models import Suspect
from apps.suspects.wanted_sync import WANTED_LINK_PREFIX, wanted_mobile_row

logger = logging.getLogger(__name__)

_collection_ready = False
_collection_lock = threading.Lock()


def insightface_enabled() -> bool:
    if not getattr(settings, "INSIGHTFACE_ENABLED", True):
        return False
    return configured()


def person_id_for_suspect(suspect_id: int) -> str:
    return f"suspect-{int(suspect_id)}"


def parse_suspect_id(person_id: str, metadata: dict[str, Any] | None = None) -> int | None:
    if isinstance(metadata, dict):
        raw_meta = metadata.get("suspect_id")
        if raw_meta is not None and str(raw_meta).isdigit():
            return int(raw_meta)
    raw = (person_id or "").strip()
    if raw.lower().startswith("suspect-"):
        rest = raw.split("-", 1)[1]
        if rest.isdigit():
            return int(rest)
    if raw.isdigit():
        return int(raw)
    return None


def reset_collection_cache() -> None:
    global _collection_ready
    _collection_ready = False


def _ensure_ready() -> None:
    global _collection_ready
    if _collection_ready:
        return
    with _collection_lock:
        if _collection_ready:
            return
        ensure_collection()
        _collection_ready = True


def _missing_collection(exc: InsightFaceError) -> bool:
    if exc.error_code in {"collection_not_found"}:
        return True
    if exc.error_code in {"person_not_found", "face_not_found"}:
        return False
    return exc.status_code == 404 and exc.error_code in {"resource_not_found", ""}


def _with_collection(fn):
    """Run an InsightFace call; if the collection is gone, create it and retry once."""
    _ensure_ready()
    try:
        return fn()
    except InsightFaceError as exc:
        if not _missing_collection(exc):
            raise
        logger.warning("InsightFace collection missing; creating %s and retrying", collection_id())
        reset_collection_cache()
        _ensure_ready()
        return fn()


def _create_person_with_fallback(*, person_id: str, name: str, image: bytes, external_id: str, metadata: dict[str, Any]) -> dict[str, Any]:
    try:
        return create_person(
            person_id=person_id,
            name=name,
            image=image,
            external_id=external_id,
            metadata=metadata,
            review_mode="standard",
        )
    except InsightFaceError as exc:
        if exc.status_code == 409 and exc.error_code in {"person_exists", "external_id_exists"}:
            return _add_faces_with_fallback(person_id=person_id, image=image)
        if exc.error_code == "registration_failed":
            return create_person(
                person_id=person_id,
                name=name,
                image=image,
                external_id=external_id,
                metadata=metadata,
                review_mode="off",
            )
        raise


def _add_faces_with_fallback(*, person_id: str, image: bytes) -> dict[str, Any]:
    try:
        return add_faces(person_id=person_id, image=image, review_mode="standard")
    except InsightFaceError as exc:
        if exc.error_code == "registration_failed":
            return add_faces(person_id=person_id, image=image, review_mode="off")
        raise


def _search_threshold() -> float:
    return float(getattr(settings, "INSIGHTFACE_SEARCH_THRESHOLD", 0.4) or 0.4)


def _suspect_qs():
    return Suspect.objects.select_related(
        "suspect_type",
        "capture_county",
        "capture_sub_county",
        "address",
        "nationality",
        "created_by",
    )


def _wanted_for_suspect(suspect: Suspect):
    link = (suspect.suspect_identifier or "").strip()
    if not link.startswith(WANTED_LINK_PREFIX):
        link = (suspect.case_ref or "").strip()
    if not link.startswith(WANTED_LINK_PREFIX):
        return None
    rest = link[len(WANTED_LINK_PREFIX) :]
    if not rest.isdigit():
        return None
    from apps.mobile.models import WantedPerson

    return (
        WantedPerson.objects.select_related("citizenship", "wanted_type", "created_by")
        .filter(pk=int(rest))
        .first()
    )


def _row_for_suspect(suspect: Suspect, *, request=None) -> dict[str, Any]:
    wanted = _wanted_for_suspect(suspect)
    if wanted is not None:
        return wanted_mobile_row(wanted, suspect, request=request)
    return legacy_suspect_row(suspect, request=request)


def enroll_suspect_image(
    suspect_id: int,
    image: bytes,
    *,
    filename: str | None = None,
) -> dict[str, Any]:
    """Create or add a face for this suspect. Best-effort; does not raise on no-face."""
    del filename  # content-type is inferred from bytes
    if not insightface_enabled() or not image:
        return {"ok": False, "skipped": True, "reason": "disabled"}

    try:
        suspect = Suspect.objects.get(pk=int(suspect_id))
    except (Suspect.DoesNotExist, TypeError, ValueError):
        return {"ok": False, "reason": "suspect_not_found"}

    person_id = person_id_for_suspect(suspect.pk)
    metadata = {
        "suspect_id": suspect.pk,
        "source": getattr(suspect, "source", "") or "",
    }
    try:
        def _enroll():
            existing = get_person(person_id)
            if existing is None:
                return _create_person_with_fallback(
                    person_id=person_id,
                    name=suspect.name or person_id,
                    image=image,
                    external_id=suspect.case_ref or "",
                    metadata=metadata,
                )
            return _add_faces_with_fallback(person_id=person_id, image=image)

        payload = _with_collection(_enroll)
    except InsightFaceError as exc:
        if exc.error_code == "duplicate_identity":
            candidate = (exc.details or {}).get("candidate") or {}
            logger.info(
                "InsightFace duplicate face suspect_id=%s person_id=%s candidate=%s request_id=%s",
                suspect.pk,
                person_id,
                candidate,
                exc.request_id,
            )
            return {
                "ok": False,
                "reason": "duplicate_identity",
                "candidate": candidate,
                "request_id": exc.request_id,
            }
        logger.warning(
            "InsightFace enroll failed suspect_id=%s code=%s request_id=%s: %s",
            suspect.pk,
            exc.error_code,
            exc.request_id,
            exc,
        )
        return {
            "ok": False,
            "reason": exc.error_code or "enroll_failed",
            "message": str(exc),
            "request_id": exc.request_id,
        }

    faces = payload.get("faces") if isinstance(payload.get("faces"), list) else []
    rejected = payload.get("rejected_images") if isinstance(payload.get("rejected_images"), list) else []
    ok = bool(faces)
    logger.info(
        "InsightFace enroll suspect_id=%s person_id=%s faces=%s rejected=%s request_id=%s collection=%s",
        suspect.pk,
        person_id,
        len(faces),
        len(rejected),
        payload.get("request_id"),
        collection_id(),
    )
    return {
        "ok": ok,
        "person_id": person_id,
        "faces": faces,
        "rejected_images": rejected,
        "request_id": payload.get("request_id") or "",
    }


def unenroll_suspect(suspect_id: int) -> None:
    if not insightface_enabled():
        return
    try:
        delete_person(person_id_for_suspect(int(suspect_id)))
    except InsightFaceError as exc:
        logger.warning("InsightFace delete person failed suspect_id=%s: %s", suspect_id, exc)


def search_suspects_by_image(
    image: bytes,
    *,
    request=None,
    limit: int = 5,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    meta: dict[str, Any] = {
        "query_source": "insightface",
        "collection_id": collection_id(),
        "threshold": _search_threshold(),
        "request_id": "",
    }
    payload = _with_collection(
        lambda: search(image, limit=limit, threshold=_search_threshold())
    )
    meta["request_id"] = str(payload.get("request_id") or "")
    meta["processing_ms"] = payload.get("processing_ms")
    meta["threshold"] = payload.get("threshold", meta["threshold"])

    raw_matches = payload.get("matches") if isinstance(payload.get("matches"), list) else []
    suspect_ids: list[int] = []
    ordered: list[tuple[int, dict[str, Any]]] = []
    for item in raw_matches:
        if not isinstance(item, dict):
            continue
        person = item.get("person") if isinstance(item.get("person"), dict) else {}
        sid = parse_suspect_id(str(person.get("id") or ""), person.get("metadata") if isinstance(person.get("metadata"), dict) else None)
        if sid is None:
            continue
        suspect_ids.append(sid)
        ordered.append((sid, item))

    if not suspect_ids:
        from apps.suspects.insightface.client import get_collection

        col = get_collection() or {}
        meta["stored_embeddings"] = int(col.get("face_count") or 0)
        meta["person_count"] = int(col.get("person_count") or 0)
        meta["compatible_embeddings"] = 0
        return [], meta

    found = {
        row.pk: row
        for row in _suspect_qs().filter(pk__in=suspect_ids)
    }
    hits: list[dict[str, Any]] = []
    for sid, item in ordered:
        suspect = found.get(sid)
        if suspect is None:
            continue
        similarity = item.get("similarity")
        try:
            sim = float(similarity)
        except (TypeError, ValueError):
            sim = 0.0
        row = _row_for_suspect(suspect, request=request)
        row["match_score"] = round(max(0.0, min(sim, 1.0)) * 100, 1)
        row["match_distance"] = round(max(0.0, 1.0 - sim), 4)
        row["match_similarity"] = round(sim, 4)
        row["matched_face_id"] = item.get("matched_face_id")
        hits.append(row)

    meta["compatible_embeddings"] = len(hits)
    meta["stored_embeddings"] = len(raw_matches)
    if hits:
        meta["best_suspect_id"] = hits[0].get("id")
        meta["best_similarity"] = hits[0].get("match_similarity")
        meta["match_tier"] = "hard"
    return hits, meta
