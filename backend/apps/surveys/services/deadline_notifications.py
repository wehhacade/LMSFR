"""Expired survey-response deadlines + FCM notify (legacy surveys FCM behaviour)."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from django.db.models import F
from django.utils import timezone

from apps.suspects.fcm import APP_SURVEY, send_push_to_token
from apps.suspects.models import FCMToken
from apps.surveys.models import Response

SURVEY_MOBILE_USER_TYPE = "survey-mobile"
PUSH_TITLE = "App-ka Sahamin"


def is_survey_mobile_user(user) -> bool:
    """Match legacy Accounts.User_type.name == survey-mobile; also accept is_mobile."""
    if not user or not getattr(user, "is_active", False):
        return False
    ut = getattr(user, "user_type", None)
    if ut is not None and (getattr(ut, "name", "") or "").strip().lower() == SURVEY_MOBILE_USER_TYPE:
        return True
    return bool(getattr(user, "is_mobile", False))


def survey_only_user_queryset(*, user_id: int | None = None):
    """
    Survey-mobile accounts that are not Ilaalo/C.I.Sh agents.
    Their device tokens should be tagged `survey`, not `ilaalo`.
    """
    from apps.accounts.models import User

    qs = User.objects.filter(
        user_type__name__iexact=SURVEY_MOBILE_USER_TYPE,
        is_agent=False,
    ).select_related("user_type")
    if user_id is not None:
        qs = qs.filter(pk=user_id)
    return qs.order_by("id")


def _param_truthy(val) -> bool:
    if val is True:
        return True
    if val in (None, False, ""):
        return False
    return str(val).strip().lower() in ("1", "true", "yes", "on")


def expired_deadline_queryset(*, survey_id=None, submitted_user_id=None):
    """
    Responses whose deadline has passed.
    expires_at = submitted_at + deadline_duration (DurationField).
    """
    qs = (
        Response.objects.filter(deadline_duration__isnull=False)
        .annotate(expires_at=F("submitted_at") + F("deadline_duration"))
        .filter(expires_at__lte=timezone.now())
        .select_related("survey", "user", "county", "sub_county")
        .order_by("-expires_at")
    )
    if survey_id not in (None, ""):
        qs = qs.filter(survey_id=int(survey_id))
    if submitted_user_id not in (None, ""):
        qs = qs.filter(user_id=int(submitted_user_id))
    return qs


def serialize_expired_row(r: Response) -> dict[str, Any]:
    expires = getattr(r, "expires_at", None) or r.deadline_at
    survey_name = r.survey.name if r.survey_id else "Survey"
    return {
        "id": r.id,
        "survey_id": r.survey_id,
        "survey_name": survey_name,
        "user_id": r.user_id,
        "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
        "deadline_duration": str(r.deadline_duration) if r.deadline_duration else None,
        "expires_at": expires.isoformat() if expires else None,
        "deadline_expired": True,
        "county_id": r.county_id,
        "county_name": getattr(r.county, "name", None) if r.county_id else None,
        "sub_county_id": r.sub_county_id,
        "sub_county_name": getattr(r.sub_county, "name", None) if r.sub_county_id else None,
        "latitude": float(r.latitude) if r.latitude is not None else None,
        "longitude": float(r.longitude) if r.longitude is not None else None,
    }


def notify_expired_deadlines(
    *,
    survey_id=None,
    submitted_user_id=None,
    send_notification: bool | str | None = False,
) -> dict[str, Any]:
    """
    List expired deadline responses; optionally FCM each submitter's tokens.
    Same contract as legacy get_expired_deadlines (send_notification truthy).
    """
    do_notify = _param_truthy(send_notification)
    rows = list(expired_deadline_queryset(survey_id=survey_id, submitted_user_id=submitted_user_id))

    fcm_by_submitter: dict[int, list[FCMToken]] = defaultdict(list)
    if do_notify:
        submitter_ids = list({r.user_id for r in rows if r.user_id})
        if submitter_ids:
            for tok in FCMToken.objects.filter(
                user_id__in=submitter_ids,
                app_slug=APP_SURVEY,
            ).select_related("user"):
                fcm_by_submitter[tok.user_id].append(tok)

    message = []
    notifications_sent = 0
    for r in rows:
        item = serialize_expired_row(r)
        message.append(item)

        submitter_id = r.user_id
        if do_notify and submitter_id:
            survey_name = item["survey_name"]
            body = f"⏰ Waqtigu wuu dhacay: ({survey_name}). Fadlan hubi codsigaaga."
            data_payload = {
                "type": "survey_deadline_expired",
                "user_type": SURVEY_MOBILE_USER_TYPE,
                "response_id": str(r.id),
                "survey_id": str(r.survey_id) if r.survey_id else "",
            }
            for fcm_row in fcm_by_submitter.get(submitter_id, ()):
                if send_push_to_token(
                    token=fcm_row.fcm_token,
                    title=PUSH_TITLE,
                    body=body,
                    data_type="survey_deadline_expired",
                    data=data_payload,
                ):
                    notifications_sent += 1

    result: dict[str, Any] = {
        "results": message,
        "response_count": len(rows),
    }
    if do_notify:
        result["notifications_sent"] = notifications_sent
        result["notify_submitter_user_ids"] = list({r.user_id for r in rows if r.user_id})
        result["fcm_tokens_matched"] = sum(len(v) for v in fcm_by_submitter.values())
    return result
