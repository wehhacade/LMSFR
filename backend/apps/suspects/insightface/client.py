"""HTTP client for the InsightFace server (suspects collection only)."""

from __future__ import annotations

import json
import logging
import socket
import uuid
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)


class InsightFaceError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        status_code: int = 0,
        error_code: str = "",
        details: dict[str, Any] | None = None,
        request_id: str = "",
        retryable: bool = False,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code or ""
        self.details = details or {}
        self.request_id = request_id or ""
        self.retryable = retryable


class InsightFaceUnavailable(InsightFaceError):
    def __init__(self, message: str, **kwargs):
        kwargs.setdefault("retryable", True)
        super().__init__(message, **kwargs)


def _base_url() -> str:
    return (getattr(settings, "INSIGHTFACE_BASE_URL", "") or "").rstrip("/")


def _api_key() -> str:
    return (getattr(settings, "INSIGHTFACE_API_KEY", "") or "").strip()


def collection_id() -> str:
    return (getattr(settings, "INSIGHTFACE_SUSPECTS_COLLECTION", "") or "lmsbr-suspects").strip()


def _timeout() -> float:
    return float(getattr(settings, "INSIGHTFACE_TIMEOUT_SECONDS", 30) or 30)


def configured() -> bool:
    return bool(_base_url() and _api_key())


def _headers(*, content_type: str | None = None, json_body: bool = False) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Accept": "application/json",
    }
    if json_body:
        headers["Content-Type"] = "application/json"
    elif content_type:
        headers["Content-Type"] = content_type
    return headers


def _parse_error(status: int, raw: bytes, request_id: str) -> InsightFaceError:
    code = ""
    message = f"InsightFace HTTP {status}"
    details: dict[str, Any] = {}
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        payload = {}
    err = payload.get("error") if isinstance(payload, dict) else None
    if isinstance(err, dict):
        code = str(err.get("code") or "")
        message = str(err.get("message") or message)
        if isinstance(err.get("details"), dict):
            details = err["details"]
    rid = ""
    if isinstance(payload, dict):
        rid = str(payload.get("request_id") or "") or request_id
    retryable = status in {429, 502, 503, 504}
    cls = InsightFaceUnavailable if retryable or status >= 500 else InsightFaceError
    return cls(
        message,
        status_code=status,
        error_code=code,
        details=details,
        request_id=rid,
        retryable=retryable,
    )


def _request(
    method: str,
    path: str,
    *,
    json_body: dict[str, Any] | None = None,
    multipart: tuple[bytes, str] | None = None,
    timeout: float | None = None,
) -> tuple[int, dict[str, Any], str]:
    base = _base_url()
    if not base:
        raise InsightFaceUnavailable("INSIGHTFACE_BASE_URL is not configured.")
    if not _api_key():
        raise InsightFaceUnavailable("INSIGHTFACE_API_KEY is not configured.")

    url = f"{base}{path}"
    data: bytes | None = None
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers = _headers(json_body=True)
    elif multipart is not None:
        data, content_type = multipart
        headers = _headers(content_type=content_type)
    else:
        headers = _headers()

    req = Request(url=url, method=method.upper(), headers=headers, data=data)
    try:
        with urlopen(req, timeout=timeout or _timeout()) as resp:
            raw = resp.read()
            request_id = resp.headers.get("x-request-id") or ""
            if resp.status == 204 or not raw:
                return resp.status, {}, request_id
            payload = json.loads(raw.decode("utf-8") or "{}")
            if isinstance(payload, dict) and payload.get("request_id"):
                request_id = str(payload.get("request_id") or request_id)
            return resp.status, payload if isinstance(payload, dict) else {"data": payload}, request_id
    except HTTPError as exc:
        try:
            raw = exc.read()
        except Exception:
            raw = b""
        request_id = exc.headers.get("x-request-id") if exc.headers else ""
        raise _parse_error(exc.code, raw, request_id or "") from exc
    except (URLError, socket.timeout, TimeoutError, ConnectionError) as exc:
        raise InsightFaceUnavailable(f"InsightFace network error: {exc}") from exc


def _guess_image_type(data: bytes) -> tuple[str, str]:
    if data.startswith(b"\x89PNG"):
        return "image/png", "photo.png"
    if data.startswith(b"RIFF") and b"WEBP" in data[:16]:
        return "image/webp", "photo.webp"
    if data.startswith(b"BM"):
        return "image/bmp", "photo.bmp"
    return "image/jpeg", "photo.jpg"


def encode_multipart(
    fields: dict[str, str],
    files: list[tuple[str, bytes, str | None]] | None = None,
) -> tuple[bytes, str]:
    boundary = f"----InsightFace{uuid.uuid4().hex}"
    crlf = b"\r\n"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
                f"{value}\r\n"
            ).encode("utf-8")
        )
    for field_name, content, filename in files or []:
        mime, default_name = _guess_image_type(content)
        fname = filename or default_name
        header = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{field_name}"; filename="{fname}"\r\n'
            f"Content-Type: {mime}\r\n\r\n"
        ).encode("utf-8")
        chunks.append(header + content + crlf)
    chunks.append(f"--{boundary}--\r\n".encode("ascii"))
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def health() -> dict[str, Any]:
    status, payload, request_id = _request("GET", "/v1/health")
    payload.setdefault("request_id", request_id)
    payload.setdefault("http_status", status)
    return payload


def get_collection(coll_id: str | None = None) -> dict[str, Any] | None:
    cid = coll_id or collection_id()
    try:
        _, payload, _ = _request("GET", f"/v1/collections/{cid}")
    except InsightFaceError as exc:
        if exc.status_code == 404:
            return None
        raise
    return payload.get("collection") if isinstance(payload.get("collection"), dict) else payload


def create_collection(coll_id: str | None = None) -> dict[str, Any]:
    cid = coll_id or collection_id()
    threshold = float(getattr(settings, "INSIGHTFACE_SEARCH_THRESHOLD", 0.4) or 0.4)
    dedup = getattr(settings, "INSIGHTFACE_DEDUP_THRESHOLD", 0.55)
    body: dict[str, Any] = {
        "id": cid,
        "name": "LMSBR Suspects",
        "description": "TipPhone and mobile suspect / wanted gallery",
        "threshold": threshold,
        "save_face_crops": False,
    }
    if dedup is not None and str(dedup) != "":
        body["dedup_threshold"] = float(dedup)
    try:
        _, payload, _ = _request("POST", "/v1/collections", json_body=body)
    except InsightFaceError as exc:
        if exc.status_code == 409 and exc.error_code in {"collection_exists", "conflict"}:
            existing = get_collection(cid)
            if existing:
                return existing
        raise
    return payload.get("collection") if isinstance(payload.get("collection"), dict) else payload


def ensure_collection(coll_id: str | None = None) -> dict[str, Any]:
    existing = get_collection(coll_id)
    if existing:
        return existing
    return create_collection(coll_id)


def get_person(person_id: str, *, coll_id: str | None = None) -> dict[str, Any] | None:
    cid = coll_id or collection_id()
    try:
        _, payload, _ = _request("GET", f"/v1/collections/{cid}/persons/{person_id}")
    except InsightFaceError as exc:
        if exc.status_code == 404:
            return None
        raise
    return payload.get("person") if isinstance(payload.get("person"), dict) else payload


def create_person(
    *,
    person_id: str,
    name: str,
    image: bytes,
    external_id: str = "",
    metadata: dict[str, Any] | None = None,
    review_mode: str = "standard",
    coll_id: str | None = None,
) -> dict[str, Any]:
    cid = coll_id or collection_id()
    fields = {
        "id": person_id,
        "name": name or person_id,
        "review_mode": review_mode,
    }
    if external_id:
        fields["external_id"] = external_id
    if metadata:
        fields["metadata"] = json.dumps(metadata, separators=(",", ":"))
    body, content_type = encode_multipart(fields, [("images", image, None)])
    _, payload, request_id = _request(
        "POST",
        f"/v1/collections/{cid}/persons",
        multipart=(body, content_type),
    )
    payload.setdefault("request_id", request_id)
    return payload


def add_faces(
    *,
    person_id: str,
    image: bytes,
    review_mode: str = "standard",
    coll_id: str | None = None,
) -> dict[str, Any]:
    cid = coll_id or collection_id()
    body, content_type = encode_multipart(
        {"review_mode": review_mode},
        [("images", image, None)],
    )
    _, payload, request_id = _request(
        "POST",
        f"/v1/collections/{cid}/persons/{person_id}/faces",
        multipart=(body, content_type),
    )
    payload.setdefault("request_id", request_id)
    return payload


def delete_person(person_id: str, *, coll_id: str | None = None) -> None:
    cid = coll_id or collection_id()
    try:
        _request("DELETE", f"/v1/collections/{cid}/persons/{person_id}")
    except InsightFaceError as exc:
        if exc.status_code == 404:
            return
        raise


def search(
    image: bytes,
    *,
    limit: int = 5,
    threshold: float | None = None,
    coll_id: str | None = None,
) -> dict[str, Any]:
    cid = coll_id or collection_id()
    fields = {"limit": str(max(1, min(int(limit), 100)))}
    if threshold is not None:
        fields["threshold"] = str(threshold)
    body, content_type = encode_multipart(fields, [("image", image, None)])
    _, payload, request_id = _request(
        "POST",
        f"/v1/collections/{cid}/search",
        multipart=(body, content_type),
    )
    payload.setdefault("request_id", request_id)
    return payload
