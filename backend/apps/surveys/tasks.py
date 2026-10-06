"""Survey Celery tasks — deadline FCM off the request path."""

from celery import shared_task

from apps.surveys.services.deadline_notifications import notify_expired_deadlines


@shared_task(ignore_result=True)
def notify_expired_survey_deadlines_async(
    survey_id=None,
    submitted_user_id=None,
) -> None:
    notify_expired_deadlines(
        survey_id=survey_id,
        submitted_user_id=submitted_user_id,
        send_notification=True,
    )
