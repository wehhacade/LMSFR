"""Mobile face match + phone lookup endpoints."""

from __future__ import annotations

import base64
import binascii
import re

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser

from .face_embedder import FaceEmbedError, embed_image_bytes
from .face_service import (
    SUPPORTED_DIMS,
    lookup_persons_by_phone,
    match_faces,
    normalize_phone,
    phone_lookup_variants,
    store_suspect_embedding,
)
from .insightface import (
    enroll_suspect_image,
    insightface_enabled,
    search_suspects_by_image,
)
from .insightface.client import InsightFaceError, InsightFaceUnavailable
from .models import Suspect
from .permissions import SuspectPermission


def _parse_vectors(data) -> list[list[float]]:
    multi = data.get("vectors")
    if isinstance(multi, list) and multi and isinstance(multi[0], list):
        return [v for v in multi if isinstance(v, list)]
    single = data.get("vector")
    if isinstance(single, list) and single:
        return [single]
    return []


def _decode_image_payload(data) -> bytes | None:
    """Accept base64 photo from mobile (`image` / `photo` / `image_base64`)."""
    raw = (
        data.get("image")
        or data.get("photo")
        or data.get("image_base64")
        or data.get("photo_base64")
    )
    if not raw or not isinstance(raw, str):
        return None
    payload = raw.strip()
    if payload.startswith("data:") and "," in payload:
        payload = payload.split(",", 1)[1]
    payload = re.sub(r"\s+", "", payload)
    try:
        return base64.b64decode(payload, validate=False)
    except (binascii.Error, ValueError):
        return None


def _image_bytes_from_request(request) -> bytes | None:
    """JSON base64 (TipPhone) or multipart file (some RN builds)."""
    decoded = _decode_image_payload(getattr(request, "data", None) or {})
    if decoded:
        return decoded
    files = getattr(request, "FILES", None)
    if not files:
        return None
    for key in ("image", "photo", "file", "picture"):
        upload = files.get(key)
        if not upload:
            continue
        try:
            data = upload.read()
        except Exception:
            continue
        if data:
            return data
    return None


def _vectors_from_request(data) -> tuple[list[list[float]], dict]:
    """Build query vectors from client embedding and/or uploaded photo.

    Backfill uses the server ONNX model (EXPECTED_DIM). If the app vector dim
    differs and a photo is present, embed the photo server-side so search works.
    """
    from apps.suspects.face_embedder import EXPECTED_DIM

    meta: dict = {"query_source": "vector"}
    query_vectors = _parse_vectors(data)
    image_bytes = _decode_image_payload(data)

    use_vector = bool(query_vectors and len(query_vectors[0]) in SUPPORTED_DIMS)
    if use_vector:
        query_dim = len(query_vectors[0])
        meta["query_dim"] = query_dim
        if image_bytes and query_dim != EXPECTED_DIM:
            try:
                vector = embed_image_bytes(image_bytes)
                meta["query_source"] = "image_fallback"
                meta["query_dim"] = len(vector)
                meta["client_vector_dim"] = query_dim
                return [vector], meta
            except FaceEmbedError as exc:
                meta["embed_error"] = str(exc)
                # fall through to client vector
        return query_vectors, meta

    if not image_bytes:
        return [], meta

    try:
        vector = embed_image_bytes(image_bytes)
    except FaceEmbedError as exc:
        meta["embed_error"] = str(exc)
        return [], meta

    meta["query_source"] = "image"
    meta["query_dim"] = len(vector)
    return [vector], meta


def _legacy_perms(view):
    return permission_classes([IsAuthenticated, IsActiveUser, SuspectPermission])(view)


@_legacy_perms
@api_view(["POST"])
def suspect_lookup(request):
    """Exact phone lookup — Suspect + Wanted (home pre-check)."""
    phone = request.data.get("phone") or request.data.get("tnumber") or ""
    digits = normalize_phone(str(phone))
    if len(digits) < 9 or len(phone_lookup_variants(digits)) == 0:
        return Response(
            {
                "isError": True,
                "Message": "Lambarka waa inuu ka koobnaadaa 9 lambar (tusaale 61xxxxxxx).",
                "found": False,
                "matches": [],
            },
            status=status.HTTP_200_OK,
        )

    matches = lookup_persons_by_phone(digits, request=request)
    if not matches:
        return Response(
            {
                "isError": False,
                "Message": "Tuhmane / Wanted lama helin.",
                "found": False,
                "matches": [],
            },
            status=status.HTTP_200_OK,
        )

    primary = matches[0]
    # Wanted rows are now backed by real Suspect identities, so this id is
    # valid for existing-case and damiin endpoints too.
    suspect_id = primary.get("id")

    wanted_count = sum(1 for m in matches if m.get("source") == "wanted")
    suspect_count = len(matches) - wanted_count
    if wanted_count and suspect_count:
        message = f"Waa la helay: {suspect_count} tuhmane, {wanted_count} wanted."
    elif wanted_count:
        message = "Wanted waa la helay."
    else:
        message = "Tuhmane waa la helay."

    return Response(
        {
            "isError": False,
            "Message": message,
            "found": True,
            "matches": matches,
            "suspect_id": suspect_id,
        },
        status=status.HTTP_200_OK,
    )


def _match_response(*, found: bool, message: str, matches: list, meta: dict, is_error: bool = False):
    body = {
        "isError": is_error,
        "Message": message,
        "found": found,
        "matches": matches,
        "meta": meta,
    }
    if found and matches:
        body["suspect_id"] = matches[0].get("id")
    return Response(body, status=status.HTTP_200_OK)


@_legacy_perms
@api_view(["POST"])
def face_match(request):
    """Search suspects. TipPhone and RN keep this URL.

    Photo (`image` / `photo` / multipart file) uses InsightFace when configured.
    Vector-only bodies keep the local gallery so older RN builds still work.
    """
    image_bytes = _image_bytes_from_request(request)
    if insightface_enabled() and image_bytes:
        try:
            matches, meta = search_suspects_by_image(image_bytes, request=request)
        except InsightFaceUnavailable as exc:
            try:
                query_vectors = [embed_image_bytes(image_bytes)]
            except FaceEmbedError:
                return _match_response(
                    found=False,
                    message=str(exc) or "Raadinta wajiga way fashilantay.",
                    matches=[],
                    meta={
                        "query_source": "insightface",
                        "fallback": "local",
                        "embed_error": str(exc),
                        "request_id": getattr(exc, "request_id", "") or "",
                    },
                    is_error=True,
                )
            source_meta = {
                "query_source": "image_fallback",
                "insightface_error": str(exc),
                "request_id": getattr(exc, "request_id", "") or "",
            }
            request._insightface_fallback_vectors = query_vectors
            request._insightface_fallback_meta = source_meta
        except InsightFaceError as exc:
            if exc.error_code in {"face_not_found", "invalid_image", "liveness_fake", "liveness_input_rejected"}:
                return _match_response(
                    found=False,
                    message="Waji lama helin sawirka. Qaad sawir cad.",
                    matches=[],
                    meta={
                        "query_source": "insightface",
                        "embed_error": exc.error_code,
                        "request_id": exc.request_id,
                    },
                )
            return _match_response(
                found=False,
                message=str(exc) or "Raadinta wajiga way fashilantay.",
                matches=[],
                meta={
                    "query_source": "insightface",
                    "embed_error": exc.error_code or "search_failed",
                    "request_id": exc.request_id,
                },
                is_error=True,
            )
        else:
            if not matches:
                gallery_empty = int(meta.get("person_count") or meta.get("stored_embeddings") or 0) == 0
                return _match_response(
                    found=False,
                    message=(
                        "Waji lama kaydin nidaamka. Diiwaangeli tuhmane cusub sawir waji leh."
                        if gallery_empty
                        else "Waji lama helin nidaamka."
                    ),
                    matches=[],
                    meta=meta,
                )
            return _match_response(
                found=True,
                message="Waji ayaa la helay.",
                matches=matches,
                meta=meta,
            )

    fallback_vectors = getattr(request, "_insightface_fallback_vectors", None)
    if fallback_vectors:
        query_vectors, source_meta = fallback_vectors, getattr(request, "_insightface_fallback_meta", {})
    else:
        query_vectors, source_meta = _vectors_from_request(request.data)
    if not query_vectors:
        msg = source_meta.get("embed_error") or (
            f"Dir `vector` ({sorted(SUPPORTED_DIMS)} dim) ama sawir base64 (`image`/`photo`)."
        )
        return Response(
            {
                "isError": True,
                "Message": msg,
                "found": False,
                "matches": [],
                "meta": source_meta,
            },
            status=status.HTTP_200_OK,
        )

    try:
        threshold = float(request.data.get("threshold") or 0.60)
    except (TypeError, ValueError):
        threshold = 0.60
    threshold = max(0.35, min(1.2, threshold))

    try:
        matches, meta = match_faces(query_vectors, threshold=threshold, request=request)
    except ValueError as exc:
        return Response(
            {
                "isError": True,
                "Message": str(exc),
                "found": False,
                "matches": [],
            },
            status=status.HTTP_200_OK,
        )

    meta = {**meta, **source_meta}

    if not matches:
        msg = "Waji lama helin nidaamka."
        stored = int(meta.get("stored_embeddings") or 0)
        compatible = int(meta.get("compatible_embeddings") or 0)
        query_dim = meta.get("query_dim")
        if stored == 0:
            msg = "Waji lama kaydin nidaamka. Diiwaangeli tuhmane cusub sawir waji leh."
        elif compatible == 0:
            msg = (
                f"Model-ka app-ka (dim={query_dim}) iyo embeddings-ka server-ka "
                "isma waafaqaan. Dir sawirka (`image` base64) si server-ku u xisaabiyo."
            )
        elif compatible < max(1, stored // 10) and source_meta.get("query_source") == "vector":
            msg = (
                "Waji lama helin. Haddii aad raadinayso sawiraha backfill-ka, "
                "dir `image`/`photo` base64 (ma aha vector app-ka oo keliya)."
            )
        return Response(
            {
                "isError": False,
                "Message": msg,
                "found": False,
                "matches": [],
                "meta": meta,
            },
            status=status.HTTP_200_OK,
        )

    return Response(
        {
            "isError": False,
            "Message": "Waji ayaa la helay.",
            "found": True,
            "matches": matches,
            "suspect_id": matches[0].get("id"),
            "meta": meta,
        },
        status=status.HTTP_200_OK,
    )


@_legacy_perms
@api_view(["POST"])
def face_embedding_store(request):
    """Store or refresh embedding for a suspect (after registration or photo update).

    TipPhone/RN keep this URL. When InsightFace is configured, a photo is enrolled
    into lmsbr-suspects and a local vector is still stored as fallback.
    """
    suspect_id = request.data.get("suspect_id") or request.data.get("id")
    raw_vector = request.data.get("vector")
    if not suspect_id:
        return Response(
            {"isError": True, "Message": "suspect_id waa lagama maarmaan."},
            status=status.HTTP_200_OK,
        )

    image_bytes = _image_bytes_from_request(request)
    insight = None
    if insightface_enabled() and image_bytes:
        insight = enroll_suspect_image(int(suspect_id), image_bytes)

    # Prefer explicit vector; otherwise embed uploaded photo with server model
    if not isinstance(raw_vector, list) or len(raw_vector) not in SUPPORTED_DIMS:
        if image_bytes:
            try:
                raw_vector = embed_image_bytes(image_bytes)
            except FaceEmbedError as exc:
                if insight and insight.get("ok"):
                    return Response(
                        {
                            "isError": False,
                            "Message": "Face vector waa la kaydiyey.",
                            "suspect_id": int(suspect_id),
                            "vector_hash": insight.get("person_id") or "",
                            "meta": {"query_source": "insightface", "request_id": insight.get("request_id") or ""},
                        },
                        status=status.HTTP_201_CREATED,
                    )
                return Response(
                    {"isError": True, "Message": str(exc)},
                    status=status.HTTP_200_OK,
                )

    if not isinstance(raw_vector, list) or len(raw_vector) not in SUPPORTED_DIMS:
        if insight and insight.get("ok"):
            return Response(
                {
                    "isError": False,
                    "Message": "Face vector waa la kaydiyey.",
                    "suspect_id": int(suspect_id),
                    "vector_hash": insight.get("person_id") or "",
                    "meta": {"query_source": "insightface", "request_id": insight.get("request_id") or ""},
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {
                "isError": True,
                "Message": f"vector waa inuu noqdaa liis {sorted(SUPPORTED_DIMS)} tiro ah.",
            },
            status=status.HTTP_200_OK,
        )

    raw_vectors = request.data.get("vectors")
    multi: list[list[float]] | None = None
    if isinstance(raw_vectors, list) and raw_vectors and isinstance(raw_vectors[0], list):
        multi = raw_vectors

    try:
        row = store_suspect_embedding(
            suspect_id=int(suspect_id),
            vector=raw_vector,
            vectors=multi,
            supplied_hash=str(request.data.get("vector_hash") or ""),
        )
    except Suspect.DoesNotExist:
        return Response(
            {"isError": True, "Message": "Tuhmane lama helin."},
            status=status.HTTP_200_OK,
        )
    except ValueError as exc:
        return Response(
            {"isError": True, "Message": str(exc)},
            status=status.HTTP_200_OK,
        )

    return Response(
        {
            "isError": False,
            "Message": "Face vector waa la kaydiyey.",
            "suspect_id": row.suspect_id,
            "vector_hash": row.vector_hash,
            "meta": {
                "query_source": "insightface" if insight and insight.get("ok") else "local",
                "request_id": (insight or {}).get("request_id") or "",
            },
        },
        status=status.HTTP_201_CREATED,
    )
