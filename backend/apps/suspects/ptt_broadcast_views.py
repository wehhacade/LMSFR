"""County-wide (degmo) walkie broadcast — LiveKit group audio + FCM invite."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.call_roles import (
    can_broadcast,
    is_taliye_all,
    is_taliye_degmo,
    is_taliye_qebeed,
    qeyb_county_ids,
)
from apps.accounts.models import County
from apps.suspects.fcm import send_push_to_user

logger = logging.getLogger(__name__)
User = get_user_model()

BROADCAST_TTL_SECONDS = 45 * 60  # 45 min
BROADCAST_KEY = "ptt:broadcast:{sid}"
BROADCAST_PENDING_KEY = "ptt:broadcast:pending:{uid}"
AGENT_CAP = 100
FCM_WORKERS = 12
TOKEN_TTL_SECONDS = BROADCAST_TTL_SECONDS


def _key(session_id: str) -> str:
    return BROADCAST_KEY.format(sid=session_id)


def _pending_key(user_id: int) -> str:
    return BROADCAST_PENDING_KEY.format(uid=user_id)


def _get_session(session_id: str) -> dict[str, Any] | None:
    data = cache.get(_key(session_id))
    return data if isinstance(data, dict) else None


def _save_session(session: dict[str, Any]) -> None:
    cache.set(_key(session["id"]), session, timeout=BROADCAST_TTL_SECONDS)


def _set_pending(user_id: int, session_id: str) -> None:
    cache.set(_pending_key(user_id), session_id, timeout=BROADCAST_TTL_SECONDS)


def _clear_pending(user_id: int, session_id: str | None = None) -> None:
    key = _pending_key(user_id)
    if session_id is None:
        cache.delete(key)
        return
    if cache.get(key) == session_id:
        cache.delete(key)


def _clear_all_pending(agent_user_ids: list[int], session_id: str) -> None:
    for uid in agent_user_ids:
        _clear_pending(int(uid), session_id)


def _user_display(user) -> str:
    name = (user.get_full_name() or "").strip()
    return name or getattr(user, "username", None) or f"User {user.pk}"


def _is_broadcast_starter(user) -> bool:
    """Dev / VIP / staff — same spirit as nearby walkie callers."""
    return bool(
        getattr(user, "is_superuser", False)
        or getattr(user, "is_staff", False)
        or getattr(user, "is_admin", False)
        or getattr(user, "is_officer", False)
    )


def _livekit_configured() -> bool:
    return bool(
        (settings.LIVEKIT_URL or "").strip()
        and (settings.LIVEKIT_API_KEY or "").strip()
        and (settings.LIVEKIT_API_SECRET or "").strip()
    )


def _livekit_http_url(ws_url: str) -> str:
    u = (ws_url or "").strip()
    if u.startswith("wss://"):
        return "https://" + u[6:]
    if u.startswith("ws://"):
        return "http://" + u[5:]
    return u


def _mint_token(
    *,
    user,
    room_name: str,
    role: str,
    county_id: int,
    session_id: str,
) -> str | None:
    if not _livekit_configured():
        return None
    try:
        from livekit.api import AccessToken, VideoGrants

        metadata = json.dumps(
            {
                "role": role,
                "county_id": county_id,
                "session_id": session_id,
            }
        )
        token = (
            AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
            .with_identity(str(user.pk))
            .with_name(_user_display(user))
            .with_metadata(metadata)
            .with_ttl(timedelta(seconds=TOKEN_TTL_SECONDS))
            .with_grants(
                VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True,
                    can_publish_sources=["microphone"],
                )
            )
            .to_jwt()
        )
        return token
    except Exception as exc:
        logger.exception("LiveKit token mint failed: %s", exc)
        return None


def _close_livekit_room(room_name: str) -> None:
    """Best-effort delete room on LiveKit Cloud."""
    if not _livekit_configured() or not room_name:
        return

    async def _run() -> None:
        from livekit import api

        lk = api.LiveKitAPI(
            _livekit_http_url(settings.LIVEKIT_URL),
            settings.LIVEKIT_API_KEY,
            settings.LIVEKIT_API_SECRET,
        )
        try:
            await lk.room.delete_room(api.DeleteRoomRequest(room=room_name))
        finally:
            await lk.aclose()

    try:
        asyncio.run(_run())
    except Exception as exc:
        logger.warning("LiveKit delete_room failed room=%s: %s", room_name, exc)


def _active_agents_for_county(county_id: int, *, exclude_user_id: int) -> list[int]:
    qs = (
        User.objects.filter(
            county_id=county_id,
            is_agent=True,
            is_active=True,
            suspend=False,
        )
        .exclude(pk=exclude_user_id)
        .order_by("pk")
        .values_list("pk", flat=True)[:AGENT_CAP]
    )
    return [int(pk) for pk in qs]


def _fcm_broadcast_invite(session: dict[str, Any], agent_ids: list[int]) -> tuple[int, int]:
    """Fan-out FCM invites in parallel. Returns (sent, failed) user-level counts."""
    if not agent_ids:
        return 0, 0

    title = "Walkie degmo"
    body = f"{session.get('from_name') or 'Dev'} wuxuu bilaabay call degmo — ku biir"
    data = {
        "session_id": session["id"],
        "county_id": str(session["county_id"]),
        "room_name": session["room_name"],
        "from_user_id": str(session["from_user_id"]),
        "from_name": session.get("from_name") or "",
    }

    sent = failed = 0

    def _one(uid: int) -> bool:
        s, f = send_push_to_user(
            user_id=uid,
            title=title,
            body=body,
            data_type="ptt_broadcast",
            data=data,
        )
        return s > 0

    with ThreadPoolExecutor(max_workers=min(FCM_WORKERS, max(1, len(agent_ids)))) as pool:
        futures = {pool.submit(_one, uid): uid for uid in agent_ids}
        for fut in as_completed(futures):
            try:
                if fut.result():
                    sent += 1
                else:
                    failed += 1
            except Exception:
                failed += 1
    return sent, failed


def _fcm_broadcast_end(session: dict[str, Any]) -> None:
    agent_ids = [int(x) for x in (session.get("agent_user_ids") or [])]
    data = {
        "session_id": session["id"],
        "county_id": str(session.get("county_id") or ""),
        "room_name": session.get("room_name") or "",
    }

    def _one(uid: int) -> None:
        send_push_to_user(
            user_id=uid,
            title="Walkie degmo",
            body="Call-kii degmada waa dhammaaday",
            data_type="ptt_broadcast_end",
            data=data,
            silent=True,
        )

    if not agent_ids:
        return
    with ThreadPoolExecutor(max_workers=min(FCM_WORKERS, max(1, len(agent_ids)))) as pool:
        list(pool.map(_one, agent_ids))


def _can_join(session: dict[str, Any], user) -> bool:
    uid = int(user.pk)
    if uid == int(session["from_user_id"]):
        return True
    agent_ids = {int(x) for x in (session.get("agent_user_ids") or [])}
    if uid in agent_ids:
        return True
    # Same county active agent (late join / re-invite edge)
    if (
        getattr(user, "is_agent", False)
        and getattr(user, "is_active", False)
        and not getattr(user, "suspend", False)
        and getattr(user, "county_id", None) is not None
        and int(user.county_id) == int(session["county_id"])
    ):
        return True
    return False


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ptt_broadcast_start(request):
    """
    Dev starts a county-wide LiveKit voice room and invites active agents.
    Body: { "county_id": <int> }
    """
    if not (_is_broadcast_starter(request.user) or can_broadcast(request.user)):
        return Response(
            {"message": "Kaliya Dev/VIP ayaa bilaabi kara call degmo", "isError": True},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not _livekit_configured():
        return Response(
            {
                "message": "LiveKit lama habeyn — LIVEKIT_URL / API_KEY / API_SECRET",
                "isError": True,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        county_id = int(request.data.get("county_id"))
    except (TypeError, ValueError):
        return Response(
            {"message": "county_id waa lagama maarmaan", "isError": True},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not County.objects.filter(pk=county_id).exists():
        return Response(
            {"message": "Degmo lama helin", "isError": True},
            status=status.HTTP_404_NOT_FOUND,
        )

    if is_taliye_degmo(request.user):
        caller_county_id = getattr(request.user, "county_id", None)
        if caller_county_id is None or int(caller_county_id) != county_id:
            return Response(
                {"message": "Kaliya degmadaada ayaad call ugu diri kartaa", "isError": True},
                status=status.HTTP_403_FORBIDDEN,
            )
    elif is_taliye_qebeed(request.user):
        qeyb_ids = qeyb_county_ids(request.user)
        if county_id not in qeyb_ids:
            return Response(
                {"message": "Kaliya degmooyinka qeybtaada ayaad call ugu diri kartaa", "isError": True},
                status=status.HTTP_403_FORBIDDEN,
            )

    agent_ids = _active_agents_for_county(county_id, exclude_user_id=request.user.pk)
    session_id = str(uuid.uuid4())
    short = session_id.replace("-", "")[:8]
    room_name = f"county-{county_id}-{short}"
    from_name = _user_display(request.user)

    session = {
        "id": session_id,
        "county_id": county_id,
        "room_name": room_name,
        "from_user_id": request.user.pk,
        "from_name": from_name,
        "status": "live",
        "agent_user_ids": agent_ids,
    }
    _save_session(session)
    for uid in agent_ids:
        _set_pending(uid, session_id)

    starter_role = (
        "taliye"
        if (
            is_taliye_degmo(request.user)
            or is_taliye_all(request.user)
            or is_taliye_qebeed(request.user)
        )
        else "dev"
    )
    token = _mint_token(
        user=request.user,
        room_name=room_name,
        role=starter_role,
        county_id=county_id,
        session_id=session_id,
    )
    if not token:
        _clear_all_pending(agent_ids, session_id)
        cache.delete(_key(session_id))
        return Response(
            {"message": "LiveKit token lama sameyn karin", "isError": True},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    push_sent, push_failed = _fcm_broadcast_invite(session, agent_ids)
    logger.info(
        "PTT broadcast start %s county=%s agents=%s push sent=%s failed=%s",
        request.user.pk,
        county_id,
        len(agent_ids),
        push_sent,
        push_failed,
    )

    return Response(
        {
            "Message": {
                "session_id": session_id,
                "county_id": county_id,
                "room_name": room_name,
                "livekit_url": settings.LIVEKIT_URL,
                "token": token,
                "agent_count": len(agent_ids),
                "push_sent": push_sent,
                "push_failed": push_failed,
                "status": "live",
            },
            "isError": False,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ptt_broadcast_pending(request):
    """Agent polls for an incoming county broadcast when FCM did not deliver."""
    sid = cache.get(_pending_key(request.user.pk))
    if not sid or not isinstance(sid, str):
        return Response({"Message": None, "isError": False}, status=status.HTTP_200_OK)

    session = _get_session(sid)
    if not session or str(session.get("status") or "") != "live":
        _clear_pending(request.user.pk)
        return Response({"Message": None, "isError": False}, status=status.HTTP_200_OK)

    if not _can_join(session, request.user):
        _clear_pending(request.user.pk, sid)
        return Response({"Message": None, "isError": False}, status=status.HTTP_200_OK)

    return Response(
        {
            "Message": {
                "session_id": session["id"],
                "county_id": session["county_id"],
                "room_name": session["room_name"],
                "from_user_id": session["from_user_id"],
                "from_name": session.get("from_name") or "",
                "status": session["status"],
            },
            "isError": False,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ptt_broadcast_join(request):
    """
    Join a live county broadcast — mint LiveKit token for this user only.
    Body: { "session_id": "<uuid>" }
    """
    if not _livekit_configured():
        return Response(
            {
                "message": "LiveKit lama habeyn — LIVEKIT_URL / API_KEY / API_SECRET",
                "isError": True,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    session_id = (request.data.get("session_id") or "").strip()
    if not session_id:
        return Response(
            {"message": "session_id waa lagama maarmaan", "isError": True},
            status=status.HTTP_400_BAD_REQUEST,
        )

    session = _get_session(session_id)
    if not session or str(session.get("status") or "") != "live":
        return Response(
            {"message": "Session dhacay / lama helin", "isError": True},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not _can_join(session, request.user):
        return Response(
            {"message": "Ogolaansho ma jiro", "isError": True},
            status=status.HTTP_403_FORBIDDEN,
        )

    role = "dev" if int(request.user.pk) == int(session["from_user_id"]) else "agent"
    token = _mint_token(
        user=request.user,
        room_name=session["room_name"],
        role=role,
        county_id=int(session["county_id"]),
        session_id=session_id,
    )
    if not token:
        return Response(
            {"message": "LiveKit token lama sameyn karin", "isError": True},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    _clear_pending(request.user.pk, session_id)

    return Response(
        {
            "Message": {
                "session_id": session_id,
                "room_name": session["room_name"],
                "livekit_url": settings.LIVEKIT_URL,
                "token": token,
                "role": role,
                "county_id": session["county_id"],
            },
            "isError": False,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ptt_broadcast_session(request, session_id: str):
    session = _get_session(session_id)
    if not session:
        return Response(
            {"message": "Session dhacay / lama helin", "isError": True},
            status=status.HTTP_404_NOT_FOUND,
        )
    if not _can_join(session, request.user) and not _is_broadcast_starter(request.user):
        return Response(
            {"message": "Ogolaansho ma jiro", "isError": True},
            status=status.HTTP_403_FORBIDDEN,
        )

    agents = session.get("agent_user_ids") or []
    return Response(
        {
            "Message": {
                "session_id": session["id"],
                "status": session.get("status") or "",
                "county_id": session["county_id"],
                "room_name": session["room_name"],
                "from_user_id": session["from_user_id"],
                "from_name": session.get("from_name") or "",
                "agent_count": len(agents),
            },
            "isError": False,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ptt_broadcast_end(request):
    """Only the starter can end. Clears pending + FCM end + best-effort LiveKit close."""
    session_id = (request.data.get("session_id") or "").strip()
    if not session_id:
        return Response(
            {"message": "session_id waa lagama maarmaan", "isError": True},
            status=status.HTTP_400_BAD_REQUEST,
        )

    session = _get_session(session_id)
    if not session:
        return Response({"Message": {"status": "ended"}, "isError": False}, status=status.HTTP_200_OK)

    if int(request.user.pk) != int(session["from_user_id"]):
        return Response(
            {"message": "Kaliya kan bilaabay ayaa joojin kara", "isError": True},
            status=status.HTTP_403_FORBIDDEN,
        )

    session["status"] = "ended"
    _save_session(session)
    _clear_all_pending(list(session.get("agent_user_ids") or []), session_id)
    _fcm_broadcast_end(session)
    _close_livekit_room(session.get("room_name") or "")

    logger.info("PTT broadcast end %s sid=%s", request.user.pk, session_id)
    return Response({"Message": {"status": "ended"}, "isError": False}, status=status.HTTP_200_OK)
