"""
Investigation search API.

Auth (same options as other LMSBR surfaces):
- Preferred: JWT Bearer (like baaris / hubkadhigis), via /investigation-login or /login/
- Partner: DRF token + user_id in JSON body (EXTERNAL_API_PARTNER_GUIDE)

Search: SearchQuery (text/phone) or EmployeeIDs / ids (exact)
Envelope: { error, results, total } | { error, message }
"""
import json
import logging

from django.contrib.auth.hashers import check_password
from django.db.models import Q
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ParseError, UnsupportedMediaType
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.models import User
from apps.mobile.helpers import is_clear
from apps.suspects.models import Suspect
from apps.suspects.photo_utils import resolve_photo_url

logger = logging.getLogger(__name__)

SEARCH_RESULT_LIMIT = 50
INVESTIGATION_SEARCH_PATH = "/api/v2/investigation/search"


def _error(message, http_status=status.HTTP_400_BAD_REQUEST, request_id=None):
    payload = {"error": True, "message": message}
    response = Response(payload, status=http_status)
    if request_id:
        response["X-Request-ID"] = request_id
    return response


def _ok(results, request_id=None):
    payload = {
        "error": False,
        "results": results,
        "total": len(results),
    }
    response = Response(payload, status=status.HTTP_200_OK)
    if request_id:
        response["X-Request-ID"] = request_id
    return response


def _request_id(request):
    return request.headers.get("X-Request-ID") or request.META.get("HTTP_X_REQUEST_ID")


def _request_body_dict(request):
    """Read JSON/form body even when Content-Type is missing/wrong."""
    try:
        data = request.data
        if hasattr(data, "keys"):
            return {k: data.get(k) for k in data.keys()}
        if isinstance(data, dict):
            return dict(data)
    except (UnsupportedMediaType, ParseError, AttributeError):
        pass
    except Exception:
        pass

    raw = getattr(request, "body", b"") or b""
    if raw:
        try:
            parsed = json.loads(raw.decode("utf-8"))
            if isinstance(parsed, dict):
                return parsed
        except (ValueError, UnicodeDecodeError):
            pass

    if hasattr(request, "GET") and request.GET:
        return {k: request.GET.get(k) for k in request.GET.keys()}
    return {}


def _authenticate_investigation_request(request, body=None):
    """
    Auth: JWT Bearer on request.user, or partner body token + user_id.
    No module permission class — any authenticated/active user is enough.
    """
    rid = _request_id(request)
    body = body if body is not None else _request_body_dict(request)

    jwt_user = getattr(request, "user", None)
    if jwt_user and getattr(jwt_user, "is_authenticated", False):
        if not jwt_user.is_active:
            return None, _error(
                "You are not authorized to access this data",
                status.HTTP_401_UNAUTHORIZED,
                rid,
            )
        return jwt_user, None

    token = body.get("token")
    user_id = body.get("user_id") or body.get("id")

    if is_clear(token):
        return None, _error("Please enter your token", status.HTTP_401_UNAUTHORIZED, rid)
    if is_clear(user_id):
        return None, _error("Please enter your user_id", status.HTTP_401_UNAUTHORIZED, rid)

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        return None, _error("Your token is not valid", status.HTTP_401_UNAUTHORIZED, rid)

    auth_token = Token.objects.select_related("user").filter(key=token).first()
    if (
        not auth_token
        or auth_token.key != token
        or auth_token.user_id != user_id_int
    ):
        return None, _error("Your token is not valid", status.HTTP_401_UNAUTHORIZED, rid)

    user = auth_token.user
    if not user.is_active:
        return None, _error(
            "You are not authorized to access this data",
            status.HTTP_401_UNAUTHORIZED,
            rid,
        )
    return user, None


def _normalize_ids(raw_ids):
    """Accept EmployeeIDs / ids as list, single value, or comma-separated string."""
    if raw_ids is None or raw_ids == "":
        return []
    if isinstance(raw_ids, (list, tuple)):
        values = raw_ids
    else:
        values = [part.strip() for part in str(raw_ids).split(",")]
    return [str(v).strip() for v in values if str(v).strip()]


def _serialize_person(suspect, request):
    """Partner guide person record (+ stable aliases)."""
    location = None
    if suspect.address_id and suspect.address:
        location = suspect.address.name
    elif suspect.capture_county_id and suspect.capture_county:
        location = suspect.capture_county.name

    status_name = suspect.suspect_type.name if suspect.suspect_type else None
    occupation = suspect.occupation or ""
    workplace = suspect.goobta_shaqada or ""
    photo = resolve_photo_url(suspect.photo_url, request) if suspect.photo_url else None
    national_id = suspect.lambarka_diiwaanka or suspect.suspect_identifier or str(suspect.id)
    summary_parts = [p for p in (status_name, occupation, location) if p]
    summary = " · ".join(summary_parts) if summary_parts else (suspect.notes or suspect.offense or "")[:200]

    return {
        "id": str(suspect.id),
        "full_name": suspect.name or "",
        "name": suspect.name or "",
        "phone": suspect.phone or "",
        "mobile": suspect.phone or "",
        "national_id": national_id or "",
        "location": location or "",
        "status": status_name or "",
        "photo": photo,
        "photo_url": photo,
        "title": occupation,
        "department": workplace or location or "",
        "summary": summary,
        "mother_name": suspect.mother_name or "",
        "nickname": suspect.alias or "",
        "father_contact": suspect.father_contact or "",
        "mother_contact": suspect.mother_contact or "",
        "gender": suspect.gender or "",
        "System": "LMSBR",
    }


def _suspect_search_qs():
    return Suspect.objects.select_related(
        "suspect_type",
        "address",
        "capture_county",
    )


def _search_by_ids(ids):
    qs = _suspect_search_qs()
    id_filter = Q()
    numeric_ids = []
    for value in ids:
        id_filter |= (
            Q(suspect_identifier=value)
            | Q(lambarka_diiwaanka=value)
            | Q(phone=value)
        )
        if value.isdigit():
            numeric_ids.append(int(value))
    if numeric_ids:
        id_filter |= Q(id__in=numeric_ids)

    return list(qs.filter(id_filter).distinct().order_by("-created_at")[:SEARCH_RESULT_LIMIT])


def _search_by_query(query):
    qs = _suspect_search_qs()
    return list(
        qs.filter(
            Q(name__icontains=query)
            | Q(alias__icontains=query)
            | Q(phone__icontains=query)
            | Q(father_contact__icontains=query)
            | Q(mother_contact__icontains=query)
            | Q(lambarka_diiwaanka__icontains=query)
            | Q(suspect_identifier__icontains=query)
            | Q(cases__damiin__phone__icontains=query)
            | Q(suspectcar__ownerphone__icontains=query)
        )
        .distinct()
        .order_by("-created_at")[:SEARCH_RESULT_LIMIT]
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def investigation_login(request):
    """Issue token + user_id for investigation partners."""
    rid = _request_id(request)
    try:
        body = _request_body_dict(request)
        email = body.get("email")
        password = body.get("password")

        if is_clear(email):
            return _error("Please enter your email address", status.HTTP_400_BAD_REQUEST, rid)
        if is_clear(password):
            return _error("Please enter your password", status.HTTP_400_BAD_REQUEST, rid)

        email = str(email).lower().strip()
        user = User.objects.filter(email=email, is_active=True).first()
        password_ok = False
        if user and user.password:
            try:
                password_ok = check_password(password, user.password)
            except (TypeError, ValueError):
                password_ok = False

        if not user or not password_ok:
            return _error("Invalid email and password", status.HTTP_401_UNAUTHORIZED, rid)

        token, _ = Token.objects.get_or_create(user=user)
        return _ok(
            [
                {
                    "token": token.key,
                    "user_id": int(user.id),
                    "email": user.email,
                    "base_url": INVESTIGATION_SEARCH_PATH,
                }
            ],
            rid,
        )
    except Exception:
        logger.exception("investigation_login error")
        return _error(
            "Oops! Something went wrong. Cilad ayaa jirta fadlan la xiriir waaxda software-da.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            rid,
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def investigation_search(request):
    """
    Investigation search — same path style as other modules.

    Auth:
      - Authorization: Bearer <JWT> (like baaris), or
      - body token + user_id (partner guide)

    Body:
      - SearchQuery: name / phone / free text
      - EmployeeIDs / ids: exact ID list
    """
    rid = _request_id(request)
    try:
        body = _request_body_dict(request)
        _, error_response = _authenticate_investigation_request(request, body=body)
        if error_response:
            return error_response

        employee_ids = _normalize_ids(
            body.get("EmployeeIDs")
            if body.get("EmployeeIDs") is not None
            else body.get("ids")
        )
        search_query = (
            body.get("SearchQuery")
            if body.get("SearchQuery") is not None
            else body.get("searchQuery")
            or body.get("q")
            or body.get("query")
        )

        if not employee_ids and is_clear(search_query):
            return _error(
                "Provide SearchQuery or EmployeeIDs",
                status.HTTP_400_BAD_REQUEST,
                rid,
            )

        if employee_ids:
            suspects = _search_by_ids(employee_ids)
        else:
            suspects = _search_by_query(str(search_query).strip())

        results = [_serialize_person(s, request) for s in suspects]
        return _ok(results, rid)
    except Exception:
        logger.exception("investigation_search error")
        return _error(
            "Oops! Something went wrong. Cilad ayaa jirta fadlan la xiriir waaxda software-da.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            rid,
        )


# Backward-compatible alias for imports
get_suspect_investigation = investigation_search
