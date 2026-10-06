"""Web-facing view of the mobile discussion thread.

Agents post through the legacy endpoints, which store three levels:
SuspectResponse (falcelin) -> ResponseComment -> CommentReply. The dashboard
reads and writes the same rows so both clients share one conversation.
"""

from __future__ import annotations

from django.db.models import Prefetch
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.suspects.models import CommentReply, ResponseComment, SuspectResponse
from apps.suspects.photo_utils import resolve_photo_url

RESPONSE = "response"
COMMENT = "comment"
REPLY = "reply"


def _author_name(user) -> str:
    if user is None:
        return "—"
    full = (user.get_full_name() or "").strip()
    return full or user.username or user.email or "—"


def _media(field, request) -> str | None:
    name = getattr(field, "name", "") or ""
    if not name:
        return None
    return resolve_photo_url(name, request) or None


def _node(*, kind: str, pk: int, parent, author, body: str, created_at, image=None, audio=None, replies=None) -> dict:
    return {
        "id": pk,
        "kind": kind,
        "parent": parent,
        "author_name": author,
        "body": body or "",
        "created_at": created_at.isoformat() if created_at else "",
        "image": image,
        "audio": audio,
        "replies": replies or [],
    }


def suspect_discussion(suspect_id: int, *, request=None) -> list[dict]:
    replies_qs = CommentReply.objects.select_related("user").order_by("created_at")
    comments_qs = (
        ResponseComment.objects.select_related("user")
        .prefetch_related(Prefetch("replies", queryset=replies_qs))
        .order_by("created_at")
    )
    responses = (
        SuspectResponse.objects.filter(suspect_id=suspect_id)
        .select_related("user")
        .prefetch_related(Prefetch("comments", queryset=comments_qs))
        .order_by("-created_at")
    )

    thread = []
    for response in responses:
        comment_nodes = []
        for comment in response.comments.all():
            reply_nodes = [
                _node(
                    kind=REPLY,
                    pk=reply.pk,
                    parent=comment.pk,
                    author=_author_name(reply.user),
                    body=reply.commentsReply,
                    created_at=reply.created_at,
                )
                for reply in comment.replies.all()
            ]
            comment_nodes.append(
                _node(
                    kind=COMMENT,
                    pk=comment.pk,
                    parent=response.pk,
                    author=_author_name(comment.user),
                    body=comment.comment,
                    created_at=comment.created_at,
                    image=_media(comment.images, request),
                    audio=_media(comment.audio, request),
                    replies=reply_nodes,
                )
            )
        thread.append(
            _node(
                kind=RESPONSE,
                pk=response.pk,
                parent=None,
                author=_author_name(response.user),
                body=response.details,
                created_at=response.created_at,
                replies=comment_nodes,
            )
        )
    return thread


def add_discussion_entry(*, suspect_id: int, kind: str, target_id, body: str, user) -> dict:
    """Append to the thread, writing the row type the mobile app expects."""
    text = (body or "").strip()
    if not text:
        raise ValidationError({"body": "Fadlan qor faallada."})

    today = timezone.now().date()
    kind = (kind or RESPONSE).strip().lower()

    if kind == RESPONSE and not target_id:
        response = SuspectResponse.objects.create(
            suspect_id=suspect_id,
            user=user,
            details=text,
            date_opp=today,
        )
        return _node(
            kind=RESPONSE,
            pk=response.pk,
            parent=None,
            author=_author_name(user),
            body=response.details,
            created_at=response.created_at,
        )

    if kind == RESPONSE:
        if not SuspectResponse.objects.filter(pk=target_id, suspect_id=suspect_id).exists():
            raise ValidationError({"target_id": "Falcelinta lama helin."})
        comment = ResponseComment.objects.create(
            response_id=target_id,
            user=user,
            comment=text,
            date_opp=today,
        )
        return _node(
            kind=COMMENT,
            pk=comment.pk,
            parent=int(target_id),
            author=_author_name(user),
            body=comment.comment,
            created_at=comment.created_at,
        )

    if kind == COMMENT:
        comment_id = target_id
    elif kind == REPLY:
        comment_id = (
            CommentReply.objects.filter(pk=target_id)
            .values_list("comment_id", flat=True)
            .first()
        )
    else:
        raise ValidationError({"kind": "Nooca faallada lama aqoonsan."})

    if not ResponseComment.objects.filter(
        pk=comment_id, response__suspect_id=suspect_id
    ).exists():
        raise ValidationError({"target_id": "Faallada lama helin."})

    reply = CommentReply.objects.create(
        comment_id=comment_id,
        user=user,
        commentsReply=text,
        date_opp=today,
    )
    return _node(
        kind=REPLY,
        pk=reply.pk,
        parent=comment_id,
        author=_author_name(user),
        body=reply.commentsReply,
        created_at=reply.created_at,
    )
