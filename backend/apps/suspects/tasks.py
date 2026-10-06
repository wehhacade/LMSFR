"""Async side-effects — FCM push off the request hot path."""

from celery import shared_task

from apps.suspects.fcm import broadcast_push, send_push_to_token


@shared_task(ignore_result=True)
def push_new_suspect_async(suspect_name: str, exclude_user_id: str | None = None) -> None:
    broadcast_push(
        exclude_user_id=exclude_user_id,
        title="App-ka C.I.SH",
        body=f"🔔Tuhunsane: ( {suspect_name}) Ayaa La Liwaangeliyay, Hadaad Xog Ka Hayso So Sheeg fadlan.",
        data_type="response",
    )


@shared_task(ignore_result=True)
def push_response_comment_async(
    *,
    suspect_name: str,
    comment_text: str,
    reporter_name: str,
    county_name: str,
    exclude_user_id: str | None = None,
) -> None:
    parts = [
        f"🔔Tuhunsane {suspect_name}",
        f"Warbixinta: {comment_text}",
        f"Ka warbixiyey: {reporter_name} - {county_name}",
    ]
    body = " | ".join(p for p in parts if p)
    broadcast_push(
        exclude_user_id=exclude_user_id,
        title="App-ka C.I.SH",
        body=body,
        data_type="response",
    )


@shared_task(ignore_result=True)
def push_comment_reply_async(
    *,
    replier_name: str,
    original_commenter_name: str,
    reply_text: str,
    exclude_user_id: str | None = None,
) -> None:
    broadcast_push(
        exclude_user_id=exclude_user_id,
        title=f"({replier_name}) Reply to ({original_commenter_name})",
        body=f"🔔  {reply_text}",
        data_type="response",
    )


@shared_task(ignore_result=True)
def push_notice_async(*, title: str, body: str) -> None:
    broadcast_push(title=title, body=body, data_type="ogeysiis")


@shared_task(ignore_result=True)
def push_single_token_async(*, token: str, title: str, body: str, data_type: str = "Ogeysiis") -> None:
    send_push_to_token(token=token, title=title, body=body, data_type=data_type)
