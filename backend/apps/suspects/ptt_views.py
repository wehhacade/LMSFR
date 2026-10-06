"""Nearby walkie-talkie (PTT) signaling — FCM invite + cache SDP/ICE exchange."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from django.core.cache import cache
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.call_roles import is_taliye_all, is_taliye_degmo, is_taliye_qebeed, qeyb_county_ids
from apps.suspects.fcm import send_push_to_user

logger = logging.getLogger(__name__)
User = get_user_model()

PTT_TTL_SECONDS = 180
PTT_KEY = "ptt:{sid}"
PTT_PENDING_KEY = "ptt:pending:{uid}"


def _key(session_id: str) -> str:
    return PTT_KEY.format(sid=session_id)


def _pending_key(user_id: int) -> str:
    return PTT_PENDING_KEY.format(uid=user_id)


def _get_session(session_id: str) -> dict[str, Any] | None:
    data = cache.get(_key(session_id))
    return data if isinstance(data, dict) else None


def _save_session(session: dict[str, Any]) -> None:
    cache.set(_key(session["id"]), session, timeout=PTT_TTL_SECONDS)


def _set_pending_invite(to_user_id: int, session_id: str) -> None:
    """Index ringing sessions so agents can poll when FCM token is missing."""
    cache.set(_pending_key(to_user_id), session_id, timeout=PTT_TTL_SECONDS)


def _clear_pending_invite(to_user_id: int, session_id: str | None = None) -> None:
    key = _pending_key(to_user_id)
    if session_id is None:
        cache.delete(key)
        return
    if cache.get(key) == session_id:
        cache.delete(key)


def _user_display(user) -> str:
    name = (user.get_full_name() or "").strip()
    return name or getattr(user, "username", None) or f"User {user.pk}"


def _user_phone(user) -> str:
    return (getattr(user, "phone", None) or "").strip()


def _user_brief(user) -> dict[str, Any]:
    return {
        "id": user.pk,
        "name": _user_display(user),
        "phone": _user_phone(user),
    }


def _can_access(session: dict[str, Any], user_id: int) -> bool:
    return user_id in (int(session["from_user_id"]), int(session["to_user_id"]))


def _is_ptt_privileged(user) -> bool:
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    if getattr(user, "is_admin", False) or getattr(user, "is_officer", False):
        return True
    ut = getattr(user, "user_type", None)
    return bool(ut and (getattr(ut, "name", None) or "").lower() == "dev")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def nearby_users_brief(request):
    """Resolve user id(s) → display name + phone for Nearby / Walkie UI."""
    raw_ids = request.data.get("user_ids")
    if raw_ids is None and request.data.get("user_id") is not None:
        raw_ids = [request.data.get("user_id")]
    if not isinstance(raw_ids, list) or not raw_ids:
        return Response(
            {"message": "user_ids waa lagama maarmaan", "isError": True},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ids: list[int] = []
    for raw in raw_ids[:50]:
        try:
            ids.append(int(raw))
        except (TypeError, ValueError):
            continue
    if not ids:
        return Response(
            {"message": "user_ids sax ma aha", "isError": True},
            status=status.HTTP_400_BAD_REQUEST,
        )

    users = User.objects.filter(pk__in=ids).only(
        "id", "username", "first_name", "last_name", "phone"
    )
    briefs = [_user_brief(u) for u in users]
    return Response({"Message": briefs, "isError": False}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ptt_start(request):
    """Dev starts a walkie session toward an agent. Sends FCM invite."""
    to_raw = request.data.get("to_user_id")
    try:
        to_user_id = int(to_raw)
    except (TypeError, ValueError):
        return Response({"message": "to_user_id waa lagama maarmaan", "isError": True}, status=status.HTTP_400_BAD_REQUEST)

    if to_user_id == request.user.pk:
        return Response({"message": "Ma sameyn kartid call naftaada", "isError": True}, status=status.HTTP_400_BAD_REQUEST)

    to_user = User.objects.filter(pk=to_user_id).first()
    if not to_user:
        return Response({"message": "User lama helin", "isError": True}, status=status.HTTP_404_NOT_FOUND)

    caller = request.user
    if is_taliye_degmo(caller) or is_taliye_all(caller) or is_taliye_qebeed(caller):
        caller_county_id = getattr(caller, "county_id", None)
        qeyb_ids = qeyb_county_ids(caller) if is_taliye_qebeed(caller) else []
        if (
            not getattr(to_user, "is_agent", False)
            or not to_user.is_active
            or getattr(to_user, "suspend", False)
            or (
                is_taliye_degmo(caller)
                and (caller_county_id is None or to_user.county_id != caller_county_id)
            )
            or (
                is_taliye_qebeed(caller)
                and (not qeyb_ids or to_user.county_id not in qeyb_ids)
            )
        ):
            return Response(
                {"message": "Kaliya qof awooddaada ayaad wici kartaa", "isError": True},
                status=status.HTTP_403_FORBIDDEN,
            )
    elif not _is_ptt_privileged(caller):
        caller_county_id = getattr(caller, "county_id", None)
        if (
            caller_county_id is None
            or to_user.county_id != caller_county_id
            or not getattr(to_user, "is_agent", False)
            or not to_user.is_active
            or getattr(to_user, "suspend", False)
        ):
            return Response(
                {"message": "Kaliya qof degmadaada ayaad wici kartaa", "isError": True},
                status=status.HTTP_403_FORBIDDEN,
            )

    session_id = str(uuid.uuid4())
    from_name = _user_display(request.user)
    from_phone = _user_phone(request.user)
    session = {
        "id": session_id,
        "from_user_id": request.user.pk,
        "to_user_id": to_user_id,
        "from_name": from_name,
        "from_phone": from_phone,
        "status": "ringing",
        "offer": None,
        "answer": None,
        "candidates_from": [],
        "candidates_to": [],
    }
    _save_session(session)
    _set_pending_invite(to_user_id, session_id)

    sent, failed = send_push_to_user(
        user_id=to_user_id,
        title="Walkie-talkie",
        body=f"{from_name} wuu ku hadlayaa — taabo si aad u maqasho",
        data_type="ptt_invite",
        data={
            "session_id": session_id,
            "from_user_id": str(request.user.pk),
            "from_name": from_name,
            "from_phone": from_phone,
        },
    )
    logger.info("PTT start %s → %s push sent=%s failed=%s", request.user.pk, to_user_id, sent, failed)

    return Response(
        {
            "Message": {
                "session_id": session_id,
                "status": "ringing",
                "to_user_id": to_user_id,
                "push_sent": sent,
                "push_failed": failed,
            },
            "isError": False,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ptt_pending(request):
    """
    Agent polls for an incoming walkie invite when FCM did not deliver.
    Returns the ringing/offering session aimed at the authenticated user, or null.
    """
    sid = cache.get(_pending_key(request.user.pk))
    if not sid or not isinstance(sid, str):
        return Response({"Message": None, "isError": False}, status=status.HTTP_200_OK)

    session = _get_session(sid)
    if not session or int(session.get("to_user_id") or 0) != request.user.pk:
        _clear_pending_invite(request.user.pk)
        return Response({"Message": None, "isError": False}, status=status.HTTP_200_OK)

    status_name = str(session.get("status") or "")
    if status_name in ("ended",):
        _clear_pending_invite(request.user.pk, sid)
        return Response({"Message": None, "isError": False}, status=status.HTTP_200_OK)

    if status_name not in ("ringing", "accepted", "offering", "active"):
        return Response({"Message": None, "isError": False}, status=status.HTTP_200_OK)

    return Response(
        {
            "Message": {
                "session_id": session["id"],
                "status": status_name,
                "from_user_id": session["from_user_id"],
                "to_user_id": session["to_user_id"],
                "from_name": session.get("from_name") or "",
                "from_phone": session.get("from_phone") or "",
            },
            "isError": False,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ptt_session(request, session_id: str):
    session = _get_session(session_id)
    if not session:
        return Response({"message": "Session dhacay / lama helin", "isError": True}, status=status.HTTP_404_NOT_FOUND)
    if not _can_access(session, request.user.pk):
        return Response({"message": "Ogolaansho ma jiro", "isError": True}, status=status.HTTP_403_FORBIDDEN)

    # Return all remote candidates (client dedupes). Avoid drain-on-read races
    # that drop ICE when signal + getSession race on cache.
    i_am_from = request.user.pk == int(session["from_user_id"])
    pending = list(session["candidates_to"] if i_am_from else session["candidates_from"])

    return Response(
        {
            "Message": {
                "session_id": session["id"],
                "status": session["status"],
                "from_user_id": session["from_user_id"],
                "to_user_id": session["to_user_id"],
                "from_name": session["from_name"],
                "from_phone": session.get("from_phone") or "",
                "offer": session["offer"],
                "answer": session["answer"],
                "candidates": pending,
            },
            "isError": False,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ptt_signal(request):
    """Exchange WebRTC offer / answer / ICE candidate."""
    session_id = request.data.get("session_id")
    signal_type = (request.data.get("type") or "").strip().lower()
    if not session_id or signal_type not in ("offer", "answer", "candidate", "accept"):
        return Response(
            {"message": "session_id + type (offer|answer|candidate|accept) waa lagama maarmaan", "isError": True},
            status=status.HTTP_400_BAD_REQUEST,
        )

    session = _get_session(session_id)
    if not session:
        return Response({"message": "Session dhacay / lama helin", "isError": True}, status=status.HTTP_404_NOT_FOUND)
    if not _can_access(session, request.user.pk):
        return Response({"message": "Ogolaansho ma jiro", "isError": True}, status=status.HTTP_403_FORBIDDEN)

    i_am_from = request.user.pk == int(session["from_user_id"])

    if signal_type == "accept":
        if i_am_from:
            return Response({"message": "Kaliya agent ayaa accept gareyn kara", "isError": True}, status=status.HTTP_400_BAD_REQUEST)
        session["status"] = "accepted"
        _save_session(session)
        # Nudge caller that agent answered (optional visible push)
        send_push_to_user(
            user_id=int(session["from_user_id"]),
            title="Walkie-talkie",
            body="Agent wuu aqbalay — hadal",
            data_type="ptt_accepted",
            data={"session_id": session_id},
            silent=True,
        )
        return Response({"Message": {"status": "accepted"}, "isError": False}, status=status.HTTP_200_OK)

    if signal_type == "offer":
        sdp = request.data.get("sdp")
        if not sdp:
            return Response({"message": "sdp waa lagama maarmaan", "isError": True}, status=status.HTTP_400_BAD_REQUEST)
        session["offer"] = sdp
        session["answer"] = None
        session["candidates_from"] = []
        session["candidates_to"] = []
        session["status"] = "offering"
        _save_session(session)
        return Response({"Message": {"status": "offering"}, "isError": False}, status=status.HTTP_200_OK)

    if signal_type == "answer":
        sdp = request.data.get("sdp")
        if not sdp:
            return Response({"message": "sdp waa lagama maarmaan", "isError": True}, status=status.HTTP_400_BAD_REQUEST)
        session["answer"] = sdp
        session["status"] = "active"
        _save_session(session)
        return Response({"Message": {"status": "active"}, "isError": False}, status=status.HTTP_200_OK)

    # candidate
    candidate = request.data.get("candidate")
    if candidate is None:
        return Response({"message": "candidate waa lagama maarmaan", "isError": True}, status=status.HTTP_400_BAD_REQUEST)
    bucket = "candidates_from" if i_am_from else "candidates_to"
    session[bucket] = list(session.get(bucket) or []) + [candidate]
    # Cap growth
    if len(session[bucket]) > 40:
        session[bucket] = session[bucket][-40:]
    _save_session(session)
    return Response({"Message": {"ok": True}, "isError": False}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ptt_end(request):
    session_id = request.data.get("session_id")
    if not session_id:
        return Response({"message": "session_id waa lagama maarmaan", "isError": True}, status=status.HTTP_400_BAD_REQUEST)

    session = _get_session(session_id)
    if not session:
        return Response({"Message": {"status": "ended"}, "isError": False}, status=status.HTTP_200_OK)
    if not _can_access(session, request.user.pk):
        return Response({"message": "Ogolaansho ma jiro", "isError": True}, status=status.HTTP_403_FORBIDDEN)

    session["status"] = "ended"
    _save_session(session)
    _clear_pending_invite(int(session["to_user_id"]), session_id)

    other = int(session["to_user_id"]) if request.user.pk == int(session["from_user_id"]) else int(session["from_user_id"])
    send_push_to_user(
        user_id=other,
        title="Walkie-talkie",
        body="Call-kii waa dhammaaday",
        data_type="ptt_end",
        data={"session_id": session_id},
        silent=True,
    )
    return Response({"Message": {"status": "ended"}, "isError": False}, status=status.HTTP_200_OK)
