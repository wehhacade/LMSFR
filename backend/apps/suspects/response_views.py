"""Legacy suspect-response / FCM / notice endpoints — old /api/v2/ paths under v3."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.paginator import Paginator
from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditTrail
from apps.audit.services.audit import AuditService
from apps.suspects.fcm import broadcast_push, send_push_to_token, send_push_to_user
from apps.suspects.legacy_messages import legacy_success, legacy_validation
from apps.suspects.models import CommentReply, FCMToken, Notice, ResponseComment, SuspectResponse
from apps.suspects.photo_utils import resolve_photo_url
from apps.suspects.tasks import push_comment_reply_async, push_notice_async, push_response_comment_async

User = get_user_model()


def _is_clear(value) -> bool:
    return value in (None, "", "null", "undefined", 0, "0")


def _user_short_name(user) -> str:
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    if first and last:
        return f"{first} {last[:1]}." if last else first
    return first or user.username or user.email


def _media_url(request, field) -> str | None:
    if not field:
        return None
    try:
        url = field.url
    except (ValueError, AttributeError):
        return None
    return request.build_absolute_uri(url) if request else url


def _audit_mobile(request, user, action: str) -> None:
    AuditService.log(
        request=request,
        user=user,
        action=action,
        submodule="Macluumaadka Tuhunsanaha",
        event_type=AuditTrail.EventType.CREATE,
        async_write=True,
    )


def _get_user(user_id):
    return User.objects.get(pk=user_id)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_suspect_response(request):
    if not request.user.has_perm("suspects.add_suspectresponse"):
        return Response(legacy_validation("Ma haysatid Ogalaansho"), status=status.HTTP_200_OK)

    suspect_id = request.data.get("suspect_id")
    details = request.data.get("details")
    user_id = request.data.get("user_id")

    if _is_clear(suspect_id):
        return Response(legacy_validation("Tuhunsanaha maahin mid jira"), status=status.HTTP_200_OK)
    if _is_clear(details):
        return Response(legacy_validation("Fadlan falcelinta qor"), status=status.HTTP_200_OK)

    try:
        user = _get_user(user_id)
    except User.DoesNotExist:
        return Response(legacy_validation("User lama helin"), status=status.HTTP_200_OK)

    today = timezone.now().date()
    new_response = SuspectResponse.objects.create(
        suspect_id=suspect_id,
        details=details,
        user=user,
        date_opp=today,
    )
    _audit_mobile(request, user, f"Wuxuu Respose Ka bixiyey tuhunsanaha magaciisu yahay {new_response}")
    return Response(legacy_success(f"{new_response.details} is successfully Registred"), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_suspect_comment(request):
    if not request.user.has_perm("suspects.add_responsecomment"):
        return Response(legacy_validation("Ma haysatid Ogalaansho"), status=status.HTTP_200_OK)

    response_id = request.data.get("response_id")
    comment = request.data.get("comment", "") or ""
    images = request.FILES.get("images") or request.data.get("images") or None
    audio = request.FILES.get("audio") or request.data.get("audio") or None
    user_id = request.data.get("user_id")

    if not response_id:
        return Response(legacy_validation("Falcelinta Lama haayo"), status=status.HTTP_200_OK)
    if not comment and not images and not audio:
        return Response(
            legacy_validation("Fadlan ugu yaraan hal ka mid ah saddexda: comment, sawir, ama cod duubid soo geli"),
            status=status.HTTP_200_OK,
        )

    try:
        user = _get_user(user_id)
    except User.DoesNotExist:
        return Response(legacy_validation("User lama helin"), status=status.HTTP_200_OK)

    today = timezone.now().date()
    new_comment = ResponseComment.objects.create(
        response_id=response_id,
        comment=comment,
        images=images,
        audio=audio,
        user=user,
        date_opp=today,
    )
    _audit_mobile(request, user, f"Wuxuu Comment Ka bixiyey Falcelinta Tuhunsanaha magaciisu yahay {new_comment.comment}")

    suspect = new_comment.response.suspect
    county_name = ""
    if suspect.capture_county_id:
        county_name = suspect.capture_county.name
    try:
        push_response_comment_async.delay(
            suspect_name=suspect.name,
            comment_text=new_comment.comment or "",
            reporter_name=user.get_full_name(),
            county_name=county_name,
            exclude_user_id=str(user.pk),
        )
    except Exception:
        body = " | ".join(
            p
            for p in [
                f"🔔Tuhunsane {suspect.name}",
                f"Warbixinta: {new_comment.comment or ''}",
                f"Ka warbixiyey: {user.get_full_name()} - {county_name}",
            ]
            if p
        )
        broadcast_push(exclude_user_id=str(user.pk), title="App-ka C.I.SH", body=body, data_type="response")

    return Response(legacy_success(f"{new_comment.comment} is successfully Registred"), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_comment_reply(request):
    if not request.user.has_perm("suspects.add_commentreply"):
        return Response(legacy_validation("Ma haysatid Ogalaansho"), status=status.HTTP_200_OK)

    comment_id = request.data.get("comment_id")
    reply_text = request.data.get("commentsReply")
    user_id = request.data.get("user_id")

    if _is_clear(comment_id):
        return Response(legacy_validation("Wax falcelin ah lama helin"), status=status.HTTP_200_OK)
    if _is_clear(reply_text):
        return Response(legacy_validation("Fadlan falcelinta ka falceli"), status=status.HTTP_200_OK)

    try:
        user = _get_user(user_id)
    except User.DoesNotExist:
        return Response(legacy_validation("User lama helin"), status=status.HTTP_200_OK)

    today = timezone.now().date()
    new_reply = CommentReply.objects.create(
        comment_id=comment_id,
        commentsReply=reply_text,
        user=user,
        date_opp=today,
    )
    _audit_mobile(request, user, f"Wuxuu Reply U galay {new_reply.comment}")

    try:
        push_comment_reply_async.delay(
            replier_name=user.get_full_name(),
            original_commenter_name=new_reply.comment.user.get_full_name(),
            reply_text=new_reply.commentsReply,
            exclude_user_id=str(user.pk),
        )
    except Exception:
        broadcast_push(
            exclude_user_id=str(user.pk),
            title=f"({user.get_full_name()}) Reply to ({new_reply.comment.user.get_full_name()})",
            body=f"🔔  {new_reply.commentsReply}",
            data_type="response",
        )

    return Response(legacy_success(f"{new_reply.commentsReply} is successfully Registred"), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def suspect_response_list(request):
    if not request.user.has_perm("suspects.view_suspectresponse"):
        return Response(legacy_validation("Ma haysatid ogalaansho"), status=status.HTTP_200_OK)

    page_number = int(request.data.get("page", 1) or 1)
    qs = (
        SuspectResponse.objects.select_related("suspect", "suspect__capture_county", "user")
        .annotate(comment_total=Count("comments"))
        .order_by("-created_at")
    )
    paginator = Paginator(qs, 10)
    page = paginator.get_page(page_number)

    message = [
        {
            "id": row.id,
            "response_id": row.id,
            "howManyComment": row.comment_total,
            "name": row.suspect.name,
            "suspect_id": row.suspect_id,
            "photo": resolve_photo_url(row.suspect.photo_url, request),
            "degmo": row.suspect.capture_county.name if row.suspect.capture_county_id else None,
            "details": row.details,
            "userka": _user_short_name(row.user),
            "tariikhda": row.date_opp,
        }
        for row in page
    ]
    return Response(
        {
            "Message": message,
            "total_pages": paginator.num_pages,
            "current_page": page_number,
            "isError": False,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def response_comment_list(request):
    if not request.user.has_perm("suspects.view_responsecomment"):
        return Response(legacy_validation("Ma haysatid Ogalaansho"), status=status.HTTP_200_OK)

    response_id = request.data.get("response_id")
    if _is_clear(response_id):
        return Response(legacy_validation("waxan kaa maqan idga responsiga"), status=status.HTTP_200_OK)

    rows = (
        ResponseComment.objects.filter(response_id=response_id)
        .select_related("response__suspect", "user")
        .annotate(reply_total=Count("replies"))
        .order_by("-created_at")
    )
    message = [
        {
            "id": row.id,
            "howmanyreplay": row.reply_total,
            "howManyComment": row.reply_total,
            "name": row.response.suspect.name,
            "comment": row.comment,
            "images": _media_url(request, row.images),
            "audio": _media_url(request, row.audio),
            "userka": row.user.first_name,
        }
        for row in rows
    ]
    return Response({"Message": message, "isError": False}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def comment_response_reply(request):
    if not request.user.has_perm("suspects.view_commentreply"):
        return Response(legacy_validation("Ma haysatid Ogalaansho"), status=status.HTTP_200_OK)

    comment_id = request.data.get("comment_id")
    if _is_clear(comment_id):
        return Response(legacy_validation("waxan kaa maqan idga responsiga"), status=status.HTTP_200_OK)

    rows = CommentReply.objects.filter(comment_id=comment_id).select_related("user").order_by("-created_at")
    message = [
        {
            "id": row.id,
            "comment_id": row.comment_id,
            "details": row.commentsReply,
            "userka": row.user.first_name,
            "tariikhda": row.date_opp,
        }
        for row in rows
    ]
    return Response({"Message": message, "isError": False}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def response_comment_images(request):
    if not request.user.has_perm("suspects.view_responsecomment"):
        return Response(legacy_validation("Ma haysatid Ogalaansho"), status=status.HTTP_200_OK)

    response_id = request.data.get("response_id")
    if _is_clear(response_id):
        return Response(legacy_validation("waxan kaa maqan idga responsiga"), status=status.HTTP_200_OK)

    rows = ResponseComment.objects.filter(response_id=response_id).only("id", "images").order_by("-created_at")
    message = [{"id": row.id, "images": _media_url(request, row.images)} for row in rows]
    return Response({"Message": message, "isError": False}, status=status.HTTP_200_OK)


@api_view(["POST"])
def save_token_to_backend(request):
    if not request.user or not request.user.is_authenticated:
        return Response({"message": "User not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)

    token = request.data.get("token")
    if not token:
        return Response({"message": "Fadlan qor FCM Token-ka"}, status=status.HTTP_400_BAD_REQUEST)

    existing = FCMToken.objects.filter(fcm_token=token).first()
    if existing:
        if existing.user_id != request.user.pk or existing.app_slug != FCMToken.AppSlug.ILAALO:
            existing.user = request.user
            existing.app_slug = FCMToken.AppSlug.ILAALO
            existing.save(update_fields=["user", "app_slug"])
            return Response({"message": "Token-ka waxaa loo wareejiyay user-kan"}, status=status.HTTP_200_OK)
        return Response({"message": "Token-kan waa hore ayaa loo diiwaan geliyay"}, status=status.HTTP_200_OK)

    FCMToken.objects.create(
        user=request.user,
        fcm_token=token,
        app_slug=FCMToken.AppSlug.ILAALO,
    )
    return Response({"message": "FCM Token-ka cusub waa la keydiyay"}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def send_push_notification(request):
    token = request.data.get("token")
    if not token:
        return Response({"message": "Fadlan qor FCM Token-ka"}, status=status.HTTP_400_BAD_REQUEST)

    notification_type = request.data.get("type", "Ogeysiis")
    title = request.data.get("title", "App-ka C.I.SH")
    body = request.data.get("body", "Tuhunsane Cusub ayaa la diwaangaliyay, Fadlan kaso warbixi.")

    if send_push_to_token(token=token, title=title, body=body, data_type=notification_type):
        return Response({"success": True}, status=status.HTTP_200_OK)
    return Response({"error": "FCM token is invalid or expired", "token_removed": True}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_notice(request):
    user_id = request.data.get("user_id")
    title = request.data.get("title")
    body = request.data.get("body")

    if not title:
        return Response({"message": "Fadlan qor ciwaanka wargelinta"}, status=status.HTTP_200_OK)
    if not body:
        return Response({"message": "Fadlan qor faahfaahinta wargelinta"}, status=status.HTTP_200_OK)

    try:
        user = _get_user(user_id)
    except User.DoesNotExist:
        return Response({"message": "User lama helin"}, status=status.HTTP_200_OK)

    Notice.objects.create(
        tobic=title,
        body=body,
        user=user,
        date_opp=timezone.now().date(),
    )
    # Target the notice recipient — do not broadcast to every device token.
    sent, failed = send_push_to_user(
        user_id=user.pk,
        title=title,
        body=body,
        data_type="ogeysiis",
    )

    return Response(
        {
            "message": "Notice sent successfully" if sent else "Notice saved but push failed",
            "user_id": user.pk,
            "push_sent": sent,
            "push_failed": failed,
            "isError": sent == 0,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def notice_list(request):
    if not request.user.has_perm("suspects.view_notice"):
        return Response(legacy_validation("Ma haysatid Ogalaansho"), status=status.HTTP_200_OK)

    date_filter = request.data.get("dateFilter", "")
    filters = {}
    if date_filter:
        filters["date_opp"] = date_filter

    rows = Notice.objects.filter(**filters).select_related("user").order_by("-created_at")
    message = [
        {
            "id": row.id,
            "tobic": row.tobic,
            "body": row.body,
            "status": row.is_new,
            "user": row.user.get_full_name(),
            "dateopp": row.date_opp,
            "date": row.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }
        for row in rows
    ]
    return Response({"Message": message, "isError": False}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_notice_status(request):
    tobic_id = request.data.get("tobic_id")
    new_status = request.data.get("new_status")

    if tobic_id is None or new_status is None:
        return Response({"error": "Please provide both 'tobic_id' and 'new_status'."}, status=status.HTTP_400_BAD_REQUEST)
    if new_status not in (0, 1):
        return Response({"error": "Invalid value for 'new_status'. Must be '0' or '1'."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        notice = Notice.objects.get(pk=tobic_id)
    except Notice.DoesNotExist:
        return Response({"error": "Notice with the given ID does not exist."}, status=status.HTTP_404_NOT_FOUND)

    notice.is_new = int(new_status)
    notice.save(update_fields=["is_new"])
    label = "New" if notice.is_new else "Not New"
    return Response({"message": f"Notice '{notice.tobic}' status updated successfully to {label}."}, status=status.HTTP_200_OK)
