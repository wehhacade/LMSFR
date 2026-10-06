"""Server-side face embedding from suspect photos (ONNX MobileFaceNet-family).

Uses a small CPU ONNX model. Safe defaults: skip missing/bad images, no crash on
single-row failures. Mobile apps may send 192-d vectors; this model outputs 256-d.
Face-match accepts a photo (`image`/`photo` base64) so search uses the same model
as backfill regardless of the phone embedding size.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

MODEL_FILENAME = "facex_nano.onnx"
INPUT_SIZE = 112
# facex_nano release notes say 512; shipped file outputs 256
EXPECTED_DIM = 256


class FaceEmbedError(Exception):
    """Non-fatal embedding failure for one photo."""


def model_path() -> Path:
    override = getattr(settings, "FACE_EMBEDDING_MODEL_PATH", None)
    if override:
        return Path(override)
    return Path(__file__).resolve().parent / "face_models" / MODEL_FILENAME


@lru_cache(maxsize=1)
def _session():
    path = model_path()
    if not path.is_file():
        raise FaceEmbedError(
            f"Face model missing: {path}. Place {MODEL_FILENAME} under apps/suspects/face_models/."
        )
    try:
        import onnxruntime as ort
    except ImportError as exc:
        raise FaceEmbedError("onnxruntime is not installed. pip install onnxruntime numpy") from exc

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = int(getattr(settings, "FACE_EMBEDDING_THREADS", 1) or 1)
    sess = ort.InferenceSession(str(path), sess_options=opts, providers=["CPUExecutionProvider"])
    return sess


def _load_rgb_bytes(data: bytes):
    from io import BytesIO

    from PIL import Image, ImageOps

    try:
        img = Image.open(BytesIO(data))
        img = ImageOps.exif_transpose(img)
        return img.convert("RGB")
    except Exception as exc:
        raise FaceEmbedError(f"Cannot open image: {exc}") from exc


def _preprocess(img) -> Any:
    import numpy as np

    img = img.resize((INPUT_SIZE, INPUT_SIZE), Image.Resampling.BILINEAR)
    arr = np.asarray(img, dtype=np.float32)
    # Normalize to [-1, 1] (facex_nano / MobileFaceNet style)
    arr = (arr - 127.5) / 127.5
    arr = np.transpose(arr, (2, 0, 1))[None, ...]
    return arr


# Late import for type checkers / resize
from PIL import Image  # noqa: E402


def embed_image_bytes(data: bytes) -> list[float]:
    """Return L2-normalized embedding list from raw image bytes."""
    import numpy as np

    from apps.suspects.face_service import l2_normalize

    if not data:
        raise FaceEmbedError("Empty image bytes")

    img = _load_rgb_bytes(data)
    # Reject tiny / empty-looking images
    if min(img.size) < 32:
        raise FaceEmbedError("Image too small for face embedding")

    tensor = _preprocess(img)
    sess = _session()
    in_name = sess.get_inputs()[0].name
    out_name = sess.get_outputs()[0].name
    raw = sess.run([out_name], {in_name: tensor})[0]
    vec = np.asarray(raw, dtype=np.float64).ravel()
    if vec.size not in (128, 192, 256, 512):
        raise FaceEmbedError(f"Unexpected embedding size {vec.size}")
    return l2_normalize(vec.tolist())


def resolve_suspect_photo_bytes(suspect) -> bytes | None:
    """Load photo bytes from S3, local MEDIA, or HTTP URL. Returns None if unavailable."""
    from django.conf import settings as dj_settings

    from apps.suspects.photo_utils import (
        _s3_configured,
        _s3_client,
        is_legacy_s3_key,
        normalize_legacy_media_key,
        resolve_legacy_s3_photo_url,
        resolve_photo_url,
        use_s3_storage,
    )

    raw = (getattr(suspect, "photo_url", None) or "").strip()
    if not raw:
        return None

    key = normalize_legacy_media_key(raw)

    # Prefer S3 when enabled / key is a known media object.
    if key and _s3_configured() and (use_s3_storage() or is_legacy_s3_key(key)):
        try:
            obj = _s3_client().get_object(
                Bucket=dj_settings.AWS_STORAGE_BUCKET_NAME,
                Key=key,
            )
            body = obj["Body"].read()
            if body:
                return body
        except Exception as exc:
            logger.debug("S3 get_object failed suspect=%s key=%s: %s", suspect.pk, key, exc)

    candidates: list[Path] = []
    media_root = Path(dj_settings.MEDIA_ROOT)
    if key:
        candidates.append(media_root / key.lstrip("/"))
        if not key.startswith("suspects/"):
            candidates.append(media_root / "suspects" / Path(key).name)
        candidates.append(media_root / Path(key).name)

    if raw.startswith("/media/"):
        candidates.append(media_root / raw[len("/media/") :].lstrip("/"))
    elif raw.startswith("media/"):
        candidates.append(media_root / raw[len("media/") :].lstrip("/"))

    for path in candidates:
        try:
            if path.is_file():
                return path.read_bytes()
        except OSError:
            continue

    # Presigned / resolved HTTP URL fallback
    urls: list[str] = []
    signed = resolve_legacy_s3_photo_url(raw)
    if signed:
        urls.append(signed)
    resolved = resolve_photo_url(raw)
    if resolved and resolved not in urls:
        urls.append(resolved)
    if raw.startswith("http://") or raw.startswith("https://"):
        urls.append(raw)

    for url in urls:
        try:
            from urllib.request import Request, urlopen

            req = Request(url, headers={"User-Agent": "lmsbr-face-backfill/1.0"})
            with urlopen(req, timeout=20) as resp:  # noqa: S310
                data = resp.read()
                if data:
                    return data
        except Exception as exc:
            logger.debug("HTTP photo fetch failed suspect=%s: %s", suspect.pk, exc)
            continue

    return None


def embed_suspect_photo(suspect) -> list[float]:
    data = resolve_suspect_photo_bytes(suspect)
    if not data:
        raise FaceEmbedError("Photo file not found")
    return embed_image_bytes(data)
