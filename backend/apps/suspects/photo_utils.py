"""Resolve and store suspect photo URLs (web + mobile)."""

from __future__ import annotations

import base64
import binascii
import logging
import os
import re
import uuid
from functools import lru_cache
from io import BytesIO
from urllib.parse import unquote, urlparse

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

# DB paths that point at S3 object keys (legacy + v3 local-style prefixes)
_LEGACY_S3_PREFIXES = (
    "suspects/",
    "damiinada/",
    "suspect_images/",
    "damiinka_pictures/",
    "damiinada_pictures/",
    "avatars/",
    "agents/",
    "uploads/agents/",
    "uploads/visitors/",
    "uploads/surveys/",
    "uploads/hubkadhigista/",
    "uploads/disarmament/",
    "fejignaanta/",
    "dhacdo_documents/",
    "dhacdooyinka/",
    "suspectresponseimg/",
    "responseaudio/",
    "car_pictures/",
    "carpictures/",
    "warbixinada_images/",
    "wanted_images/",
    "media/",
)


def _api_base() -> str:
    return getattr(settings, "PUBLIC_API_BASE_URL", "http://localhost:8000").rstrip("/")


def _photo_max_size() -> tuple[int, int]:
    size = getattr(settings, "SUSPECT_PHOTO_MAX_SIZE", (1920, 1080))
    return int(size[0]), int(size[1])


def _jpeg_quality() -> int:
    return int(getattr(settings, "SUSPECT_PHOTO_JPEG_QUALITY", 60))


def _s3_configured() -> bool:
    return bool(
        getattr(settings, "AWS_ACCESS_KEY_ID", "")
        and getattr(settings, "AWS_SECRET_ACCESS_KEY", "")
        and getattr(settings, "AWS_STORAGE_BUCKET_NAME", "")
    )


def _legacy_s3_prefixes() -> tuple[str, ...]:
    extra = getattr(settings, "AWS_S3_LEGACY_MEDIA_PREFIXES", ()) or ()
    merged = {p.lower().rstrip("/") + "/" for p in (*_LEGACY_S3_PREFIXES, *extra)}
    return tuple(sorted(merged))


def normalize_legacy_media_key(photo_url: str | None) -> str:
    """Turn a DB path or partial S3 URL into an object key inside the legacy bucket."""
    raw = (photo_url or "").strip()
    if not raw:
        return ""

    if raw.startswith(("http://", "https://")):
        parsed = urlparse(raw)
        host = (parsed.netloc or "").lower()
        if "amazonaws.com" in host:
            path = unquote(parsed.path.lstrip("/"))
            if path.startswith(f"{settings.AWS_STORAGE_BUCKET_NAME}/"):
                return path[len(settings.AWS_STORAGE_BUCKET_NAME) + 1 :]
            return path
        # Absolute /media/… URLs from our own API still map to S3 keys.
        path = unquote(parsed.path.lstrip("/"))
        media = settings.MEDIA_URL.strip("/")
        if media and path.startswith(f"{media}/"):
            return path[len(media) + 1 :]
        return ""

    key = raw.lstrip("/")
    media = settings.MEDIA_URL.strip("/")
    if media and key.startswith(f"{media}/"):
        key = key[len(media) + 1 :]
    return key


def is_legacy_s3_key(key: str) -> bool:
    """True when the key should be served from the LMSBR S3 bucket."""
    if not key:
        return False
    lower = key.lower()
    return any(lower.startswith(prefix) for prefix in _legacy_s3_prefixes())


def use_s3_storage() -> bool:
    return bool(getattr(settings, "USE_S3", False) and _s3_configured())


@lru_cache(maxsize=1)
def _s3_client():
    import boto3

    return boto3.client(
        "s3",
        region_name=getattr(settings, "AWS_S3_REGION_NAME", "us-east-1"),
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def presigned_s3_url(object_key: str, *, expires_in: int | None = None) -> str:
    """Signed GET URL for a private legacy S3 object."""
    from django.core.cache import cache

    expiry = expires_in or int(getattr(settings, "AWS_S3_PRESIGNED_EXPIRY", 3600))
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    cache_key = f"s3presign:{bucket}:{object_key}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    url = _s3_client().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket,
            "Key": object_key,
        },
        ExpiresIn=expiry,
    )
    cache_ttl = max(expiry - 300, 60)
    cache.set(cache_key, url, cache_ttl)
    return url


def resolve_legacy_s3_photo_url(photo_url: str | None) -> str:
    key = normalize_legacy_media_key(photo_url)
    if not key or not is_legacy_s3_key(key):
        return ""
    if not _s3_configured():
        logger.debug("Legacy S3 media key %s but AWS credentials are not configured", key)
        return ""
    try:
        return presigned_s3_url(key)
    except Exception:
        logger.exception("Failed to presign S3 object %s", key)
        return ""


_FILENAME_ONLY = re.compile(r"^[\w.\- ]+\.(jpe?g|png|gif|webp)$", re.I)


def picture_payload_present(value) -> bool:
    """True for uploaded files, data-URLs, or base64 strings (not bare filenames)."""
    if value is None or value == "":
        return False
    if hasattr(value, "read"):
        return True
    if not isinstance(value, str):
        return False
    raw = value.strip()
    if not raw:
        return False
    if raw.startswith("data:image"):
        return True
    if _FILENAME_ONLY.match(raw):
        return False
    return len(raw) >= 80


def coerce_picture_upload(value):
    """
    Turn multipart file, data-URL, or raw base64 into an upload Django can store.
    Bare filenames like ``w.jpg`` are rejected (use File upload or base64).
    """
    if value is None or value == "":
        return None
    if hasattr(value, "read"):
        return value

    if not isinstance(value, str):
        return None

    raw = value.strip()
    if not raw:
        return None

    if _FILENAME_ONLY.match(raw):
        return None

    content_type = "image/jpeg"
    ext = ".jpg"
    b64 = raw

    if raw.startswith("data:"):
        header, _, payload = raw.partition(",")
        if not payload:
            return None
        b64 = payload
        if "png" in header.lower():
            content_type, ext = "image/png", ".png"
        elif "gif" in header.lower():
            content_type, ext = "image/gif", ".gif"
        elif "webp" in header.lower():
            content_type, ext = "image/webp", ".webp"

    try:
        binary = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        return None

    if not binary:
        return None

    return SimpleUploadedFile(f"upload{ext}", binary, content_type=content_type)


def optimize_suspect_image(uploaded_file) -> tuple[ContentFile, str]:
    """
    Shrink file size while keeping visual quality — same approach as legacy NISA APIs:
    EXIF rotation fix, max 1920×1080 thumbnail, JPEG quality 60 (PNG kept when needed).
    """
    if hasattr(uploaded_file, "seek"):
        uploaded_file.seek(0)

    with Image.open(uploaded_file) as img:
        image = ImageOps.exif_transpose(img)
        image.thumbnail(_photo_max_size(), Image.Resampling.LANCZOS)

        buf = BytesIO()
        name = getattr(uploaded_file, "name", "") or "photo.jpg"
        ext = os.path.splitext(name)[1].lower()

        has_alpha = image.mode in ("RGBA", "LA") or (
            image.mode == "P" and "transparency" in image.info
        )
        if ext == ".png" and has_alpha:
            image.save(buf, format="PNG", optimize=True)
            out_ext = ".png"
        else:
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.save(buf, format="JPEG", quality=_jpeg_quality(), optimize=True)
            out_ext = ".jpg"

    buf.seek(0)
    return ContentFile(buf.read()), out_ext


def resolve_photo_url(photo_url: str | None, request=None) -> str:
    """Return an absolute URL clients can load (S3 presigned, /media/, or full http)."""
    raw = (photo_url or "").strip()
    if not raw:
        return ""

    key = normalize_legacy_media_key(raw) or (
        "" if raw.startswith(("http://", "https://", "data:")) else raw.lstrip("/")
    )

    # Prefer S3 for known media keys whenever AWS is configured.
    if key and is_legacy_s3_key(key) and _s3_configured():
        try:
            signed = presigned_s3_url(key)
            if signed:
                return signed
        except Exception:
            logger.exception("Failed to presign S3 object %s", key)

    if raw.startswith(("http://", "https://", "data:")):
        return raw

    # Local FileSystemStorage fallback (USE_S3=False or object not yet migrated).
    if key and not use_s3_storage():
        try:
            if default_storage.exists(key):
                path = f"{settings.MEDIA_URL.rstrip('/')}/{key.lstrip('/')}"
                if request is not None:
                    return request.build_absolute_uri(path)
                return f"{_api_base()}{path}"
        except Exception:
            logger.debug("default_storage.exists failed for %s", key, exc_info=True)

    if request is not None:
        path = raw if raw.startswith("/") else f"{settings.MEDIA_URL.rstrip('/')}/{raw.lstrip('/')}"
        return request.build_absolute_uri(path)
    base = _api_base()
    if raw.startswith("/"):
        return f"{base}{raw}"
    media = settings.MEDIA_URL.rstrip("/")
    return f"{base}{media}/{raw.lstrip('/')}"


def store_suspect_picture(uploaded_file) -> str:
    """Optimize, then save under suspects/ (S3 when USE_S3, else local media)."""
    optimized, ext = optimize_suspect_image(uploaded_file)
    path = f"suspects/{uuid.uuid4().hex}{ext}"
    stored = default_storage.save(path, optimized)
    # Persist stable object key — not a time-limited signed URL.
    return stored.lstrip("/")


def store_damiin_picture(uploaded_file) -> str:
    """Optimize, then save under damiinada/ (S3 when USE_S3, else local media)."""
    optimized, ext = optimize_suspect_image(uploaded_file)
    path = f"damiinada/{uuid.uuid4().hex}{ext}"
    stored = default_storage.save(path, optimized)
    return stored.lstrip("/")


def enroll_suspect_photo(suspect_id: int, image_bytes: bytes) -> dict:
    """Push a stored suspect photo into InsightFace. Best-effort; never raises."""
    from apps.suspects.insightface import enroll_suspect_image, insightface_enabled

    if not insightface_enabled():
        logger.info("InsightFace enroll skipped suspect_id=%s (disabled)", suspect_id)
        return {"ok": False, "reason": "disabled"}
    if not image_bytes:
        from apps.suspects.face_embedder import resolve_suspect_photo_bytes
        from apps.suspects.models import Suspect

        stored = Suspect.objects.filter(pk=suspect_id).first()
        image_bytes = resolve_suspect_photo_bytes(stored) or b"" if stored else b""
    if not image_bytes:
        logger.warning("InsightFace enroll skipped suspect_id=%s (no photo bytes)", suspect_id)
        return {"ok": False, "reason": "no_bytes"}
    try:
        result = enroll_suspect_image(suspect_id, image_bytes)
    except Exception:
        logger.exception("InsightFace enroll crashed suspect_id=%s", suspect_id)
        return {"ok": False, "reason": "exception"}
    if result.get("ok"):
        logger.info(
            "InsightFace enroll stored suspect_id=%s person=%s faces=%s",
            suspect_id,
            result.get("person_id"),
            len(result.get("faces") or []),
        )
    else:
        logger.warning(
            "InsightFace enroll did not store a face suspect_id=%s reason=%s",
            suspect_id,
            result.get("reason") or result.get("rejected_images") or "unknown",
        )
    return result


def persist_suspect_photo(suspect_id: int, uploaded_file) -> str:
    """Save the photo to storage and enroll it before returning."""
    image_bytes = b""
    try:
        if hasattr(uploaded_file, "seek"):
            uploaded_file.seek(0)
        image_bytes = uploaded_file.read()
        if hasattr(uploaded_file, "seek"):
            uploaded_file.seek(0)
    except Exception:
        logger.exception("Could not read photo bytes for suspect_id=%s", suspect_id)
        image_bytes = b""
    url = store_suspect_picture(uploaded_file)
    enroll_suspect_photo(suspect_id, image_bytes)
    return url


def _materialize_upload(uploaded_file) -> SimpleUploadedFile | None:
    """
    Copy upload bytes into memory while the request file is still open.

    TemporaryUploadedFile is closed when the request ends; a daemon thread that
    reads later hits ``ValueError: read of closed file``.
    """
    if uploaded_file is None:
        return None
    if hasattr(uploaded_file, "seek"):
        try:
            uploaded_file.seek(0)
        except Exception:
            pass
    name = getattr(uploaded_file, "name", None) or "photo.jpg"
    content_type = getattr(uploaded_file, "content_type", None) or "image/jpeg"
    data = uploaded_file.read()
    if not data:
        return None
    return SimpleUploadedFile(name, data, content_type=content_type)


def schedule_photo_updates(jobs: list[tuple[str, int, str, object]]) -> None:
    """
    Persist photos after the DB transaction commits, still inside the request.

    Face enroll used to run on a daemon thread. ``make start`` force-recreates
    Django and kills that thread, so a newly registered person had a photo in
    LMSBR but no face in InsightFace — search returned not found.
    """
    if not jobs:
        return

    from django.db import transaction

    from apps.suspects.models import Damiinada, Suspect

    prepared: list[tuple[str, int, str, SimpleUploadedFile]] = []
    for entity, pk, field_name, upload in jobs:
        try:
            material = _materialize_upload(upload)
        except Exception:
            logger.exception("Failed to read upload for %s %s.%s", entity, pk, field_name)
            continue
        if material is None:
            logger.warning("Empty upload for %s %s.%s — skipped", entity, pk, field_name)
            continue
        prepared.append((entity, pk, field_name, material))

    if not prepared:
        return

    def _worker() -> None:
        logger.info(
            "Photo persist starting jobs=%s",
            [(entity, pk, field_name) for entity, pk, field_name, _ in prepared],
        )
        for entity, pk, field_name, upload in prepared:
            try:
                if entity == "suspect" and field_name == "photo_url":
                    url = persist_suspect_photo(pk, upload)
                elif entity == "damiin":
                    url = store_damiin_picture(upload)
                else:
                    url = store_suspect_picture(upload)
                model = Damiinada if entity == "damiin" else Suspect
                model.objects.filter(pk=pk).update(**{field_name: url})
                logger.info("Photo persist saved %s %s.%s url=%s", entity, pk, field_name, url)
            except Exception:
                logger.exception("Photo persist failed for %s %s.%s", entity, pk, field_name)

    transaction.on_commit(_worker)
