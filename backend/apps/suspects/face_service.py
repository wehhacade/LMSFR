"""Face embedding storage and Euclidean distance search."""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any

from apps.suspects.legacy_suspect_row import legacy_suspect_row
from apps.suspects.models import Suspect, SuspectFaceEmbedding
from apps.suspects.wanted_sync import (
    ensure_all_wanted_suspects,
    ensure_wanted_suspect,
    wanted_mobile_row,
)

SUPPORTED_DIMS = {128, 192, 256, 512}
# L2-normalized MobileFaceNet — require ≥70% match (distance ≤ 0.60) for pre-check
DEFAULT_MATCH_THRESHOLD = 0.60
SOFT_MATCH_THRESHOLD = 1.0
SOFT_MATCH_MIN_GAP = 0.12
SINGLE_CANDIDATE_MAX_DISTANCE = 0.60
ABSOLUTE_MAX_DISTANCE = 1.15
MAX_MATCHES = 5
# Soft cap so large galleries stay searchable without loading forever
MAX_EMBEDDING_SCAN = 50_000


def normalize_phone(value: str) -> str:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    if len(digits) == 9 and digits[0] == "6":
        return f"0{digits}"
    return digits


def phone_lookup_variants(value: str) -> list[str]:
    """
    Phone forms stored in DB vary (9 vs 10 digits, leading 0).
    Return unique digit strings suitable for exact / icontains match.
    """
    raw = "".join(ch for ch in (value or "") if ch.isdigit())
    if not raw:
        return []
    variants: set[str] = {raw, normalize_phone(raw)}
    for item in list(variants):
        if item.startswith("0") and len(item) > 1:
            variants.add(item.lstrip("0") or item)
        if len(item) == 9 and item[0] == "6":
            variants.add(f"0{item}")
        if len(item) == 10 and item.startswith("0"):
            variants.add(item[1:])
    # Prefer meaningful local numbers (Somali mobile ~9–10 digits)
    return sorted({v for v in variants if 9 <= len(v) <= 12}, key=len, reverse=True)


def vector_hash(vector: list[float]) -> str:
    payload = json.dumps([round(float(v), 6) for v in vector], separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(float(x) * float(x) for x in vector))
    if norm <= 1e-12:
        return [float(v) for v in vector]
    return [float(x) / norm for x in vector]


def normalize_vector(vector: list[float]) -> list[float]:
    """L2-normalize embedding (used by tests and storage)."""
    clean = validate_vector(vector)
    return l2_normalize(clean)


def validate_vector(vector: list[float]) -> list[float]:
    dim = len(vector)
    if dim not in SUPPORTED_DIMS:
        raise ValueError(f"vector must have {sorted(SUPPORTED_DIMS)} dimensions, got {dim}")
    return [float(v) for v in vector]


def euclidean_distance(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 999.0
    na = l2_normalize(a)
    nb = l2_normalize(b)
    return math.sqrt(sum((float(x) - float(y)) ** 2 for x, y in zip(na, nb, strict=False)))


def _stored_variants(row: SuspectFaceEmbedding) -> list[list[float]]:
    raw_multi = getattr(row, "vectors", None)
    if isinstance(raw_multi, list) and raw_multi and isinstance(raw_multi[0], list):
        out: list[list[float]] = []
        for item in raw_multi:
            try:
                out.append(validate_vector(item))
            except ValueError:
                continue
        if out:
            return out
    if isinstance(row.vector, list) and row.vector:
        try:
            return [validate_vector(row.vector)]
        except ValueError:
            return []
    return []


def store_suspect_embedding(
    *,
    suspect_id: int,
    vector: list[float],
    vectors: list[list[float]] | None = None,
    supplied_hash: str | None = None,
) -> SuspectFaceEmbedding:
    if not Suspect.objects.filter(pk=suspect_id).exists():
        raise Suspect.DoesNotExist

    clean_variants: list[list[float]] = []
    if vectors:
        for item in vectors:
            try:
                clean_variants.append(validate_vector(item))
            except ValueError:
                continue
    if not clean_variants:
        clean_variants = [validate_vector(vector)]

    clean_variants = [l2_normalize(v) for v in clean_variants]
    primary = clean_variants[0]
    digest = (supplied_hash or "").strip() or vector_hash(primary)
    row, _ = SuspectFaceEmbedding.objects.update_or_create(
        suspect_id=suspect_id,
        defaults={
            "vector": primary,
            "vectors": clean_variants,
            "vector_hash": digest,
        },
    )
    return row


def lookup_suspect_by_phone(phone: str, *, request=None) -> dict[str, Any] | None:
    rows = lookup_suspects_by_phone(phone, request=request)
    return rows[0] if rows else None


def lookup_suspects_by_phone(phone: str, *, request=None) -> list[dict[str, Any]]:
    variants = phone_lookup_variants(phone)
    if not variants:
        return []
    qs = (
        Suspect.objects.select_related(
            "suspect_type",
            "capture_county",
            "capture_sub_county",
            "address",
            "nationality",
            "created_by",
        )
        .filter(phone__in=variants)
        .order_by("-id")
    )
    out: list[dict[str, Any]] = []
    for suspect in qs[:10]:
        row = legacy_suspect_row(suspect, request=request)
        row["source"] = getattr(suspect, "source", None) or "suspect"
        out.append(row)
    return out


def _legacy_wanted_row(wanted, *, request=None) -> dict[str, Any]:
    suspect = ensure_wanted_suspect(wanted)
    return wanted_mobile_row(wanted, suspect, request=request)


def lookup_wanteds_by_phone(phone: str, *, request=None) -> list[dict[str, Any]]:
    from apps.mobile.models import WantedPerson

    variants = phone_lookup_variants(phone)
    if not variants:
        return []
    qs = (
        WantedPerson.objects.select_related("citizenship", "wanted_type", "created_by")
        .filter(phone__in=variants)
        .order_by("-date_recorded")
    )
    return [_legacy_wanted_row(w, request=request) for w in qs[:10]]


def lookup_persons_by_phone(phone: str, *, request=None) -> list[dict[str, Any]]:
    """Home phone search: Wanted + Suspect (Wanted first)."""
    wanted = lookup_wanteds_by_phone(phone, request=request)
    suspects = lookup_suspects_by_phone(phone, request=request)
    wanted_suspect_ids = {row["id"] for row in wanted}
    return wanted + [row for row in suspects if row.get("id") not in wanted_suspect_ids]


def _coerce_query_vectors(vectors: list[list[float]] | list[float]) -> list[list[float]]:
    if vectors and isinstance(vectors[0], (int, float)):
        return [vectors]  # type: ignore[list-item]
    return list(vectors)  # type: ignore[arg-type]


def match_faces(
    vectors: list[list[float]] | list[float],
    *,
    threshold: float = DEFAULT_MATCH_THRESHOLD,
    request=None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # Wanted photos use the same server embedder/storage and therefore the same
    # L2 distance scale. Records without a usable face are intentionally skipped.
    wanted_by_suspect = ensure_all_wanted_suspects(embed_photos=True)
    query_vectors = _coerce_query_vectors(vectors)
    meta: dict[str, Any] = {
        "stored_embeddings": 0,
        "compatible_embeddings": 0,
        "query_variants": len(query_vectors),
        "query_dim": None,
        "best_distance": None,
        "best_suspect_id": None,
        "second_distance": None,
    }

    if not query_vectors:
        return [], meta

    clean_queries: list[list[float]] = []
    for raw in query_vectors:
        if not isinstance(raw, list):
            continue
        try:
            clean_queries.append(validate_vector(raw))
        except ValueError:
            continue
    if not clean_queries:
        return [], meta
    meta["query_dim"] = len(clean_queries[0])

    rows = list(
        SuspectFaceEmbedding.objects.select_related(
            "suspect",
            "suspect__suspect_type",
            "suspect__capture_county",
            "suspect__capture_sub_county",
            "suspect__address",
            "suspect__nationality",
            "suspect__created_by",
        )
        .filter(suspect__isnull=False)
        .order_by("-updated_at")[:MAX_EMBEDDING_SCAN]
    )
    meta["stored_embeddings"] = len(rows)

    best_by_suspect: dict[int, tuple[float, dict[str, Any]]] = {}

    for row in rows:
        stored_variants = _stored_variants(row)
        if not stored_variants:
            continue
        suspect = row.suspect
        sid = int(suspect.id)
        best_dist = 999.0

        for query in clean_queries:
            for stored_vec in stored_variants:
                dist = euclidean_distance(query, stored_vec)
                if dist < best_dist:
                    best_dist = dist

        if best_dist >= 999.0:
            continue

        prev = best_by_suspect.get(sid)
        if prev is not None and prev[0] <= best_dist:
            continue

        wanted = wanted_by_suspect.get(sid)
        payload = (
            wanted_mobile_row(wanted, suspect, request=request)
            if wanted is not None
            else legacy_suspect_row(suspect, request=request)
        )
        payload["match_score"] = round(max(0.0, (1.0 - best_dist / 2.0)) * 100, 1)
        payload["vector_hash"] = row.vector_hash
        payload["match_distance"] = round(best_dist, 4)
        best_by_suspect[sid] = (best_dist, payload)

    ranked = sorted(best_by_suspect.values(), key=lambda item: item[0])
    if ranked:
        meta["best_distance"] = round(ranked[0][0], 4)
        meta["best_suspect_id"] = ranked[0][1].get("id")
        if len(ranked) > 1:
            meta["second_distance"] = round(ranked[1][0], 4)

    meta["compatible_embeddings"] = len(best_by_suspect)

    hits: list[dict[str, Any]] = []
    for dist, payload in ranked:
        if dist <= threshold:
            hits.append(payload)

    if not hits and ranked:
        best_dist, best_payload = ranked[0]
        if best_dist <= ABSOLUTE_MAX_DISTANCE:
            if len(ranked) >= 2:
                second_dist = ranked[1][0]
                gap = second_dist - best_dist
                if best_dist <= SOFT_MATCH_THRESHOLD and gap >= SOFT_MATCH_MIN_GAP:
                    hits = [best_payload]
                    meta["match_tier"] = "soft"
            elif best_dist <= SINGLE_CANDIDATE_MAX_DISTANCE:
                hits = [best_payload]
                meta["match_tier"] = "single"

    if hits and "match_tier" not in meta:
        meta["match_tier"] = "hard"

    return hits[:MAX_MATCHES], meta
