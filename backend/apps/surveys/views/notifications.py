"""Survey mobile FCM token registration + expired-deadline notify API."""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.suspects.models import FCMToken
from apps.surveys.permissions import ResponsePermission
from apps.surveys.services.deadline_notifications import (
    is_survey_mobile_user,
    notify_expired_deadlines,
)


def _request_payload(request) -> dict:
    """Prefer JSON body; merge query params for GET convenience."""
    data = {}
    if hasattr(request, "query_params"):
        data.update({k: v for k, v in request.query_params.items()})
    if hasattr(request, "data") and request.data is not None:
        try:
            data.update(dict(request.data))
        except (TypeError, ValueError):
            pass
    return data


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveUser])
def surveys_save_fcm_token(request):
    """
    Register Firebase device token for the authenticated survey mobile user.
    Body: { "fcm_token" | "firebase_token" | "token": "<device token>" }
    """
    user = request.user
    if not is_survey_mobile_user(user):
        return Response(
            {"message": "Only survey-mobile users can register survey FCM tokens"},
            status=status.HTTP_403_FORBIDDEN,
        )

    fcm_token = (
        request.data.get("fcm_token")
        or request.data.get("firebase_token")
        or request.data.get("token")
    )
    if not fcm_token or not str(fcm_token).strip():
        return Response(
            {"message": "Fadlan qor FCM Token-ka (fcm_token)"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    fcm_token = str(fcm_token).strip()

    existing = FCMToken.objects.filter(fcm_token=fcm_token).first()
    if existing:
        if existing.user_id != user.pk or existing.app_slug != FCMToken.AppSlug.SURVEY:
            existing.user = user
            existing.app_slug = FCMToken.AppSlug.SURVEY
            existing.save(update_fields=["user", "app_slug"])
            return Response(
                {"message": "Token-ka waxaa loo wareejiyay user-kan"},
                status=status.HTTP_200_OK,
            )
        return Response(
            {"message": "Token-kan waa hore ayaa loo diiwaan geliyay"},
            status=status.HTTP_200_OK,
        )

    FCMToken.objects.create(
        user=user,
        fcm_token=fcm_token,
        app_slug=FCMToken.AppSlug.SURVEY,
    )
    return Response(
        {"message": "FCM Token-ka cusub waa la keydiyay"},
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsActiveUser, ResponsePermission])
def get_expired_deadlines(request):
    """
    List survey responses whose deadline has passed.
    Optional: send_notification=true → FCM each submitter (Response.user).

    Filters: survey_id, submitted_user_id, send_notification
    """
    payload = _request_payload(request)
    survey_id = payload.get("survey_id") or payload.get("survey")
    submitted_user_id = payload.get("submitted_user_id")
    send_notification = payload.get("send_notification")

    try:
        result = notify_expired_deadlines(
            survey_id=survey_id or None,
            submitted_user_id=submitted_user_id or None,
            send_notification=send_notification,
        )
    except (TypeError, ValueError):
        return Response(
            {"message": "Invalid survey_id or submitted_user_id"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Legacy-shaped extras for clients that expect Message / response_count
    body = {
        "isError": False,
        "Message": result["results"],
        "results": result["results"],
        "response_count": result["response_count"],
        "title": "Success",
        "type": "success",
    }
    if "notifications_sent" in result:
        body["notifications_sent"] = result["notifications_sent"]
        body["notify_submitter_user_ids"] = result["notify_submitter_user_ids"]
        body["fcm_tokens_matched"] = result["fcm_tokens_matched"]
    return Response(body, status=status.HTTP_200_OK)
