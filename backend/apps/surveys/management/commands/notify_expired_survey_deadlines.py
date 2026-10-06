"""
Notify survey-mobile submitters whose response deadline has expired.

Usage:
  python manage.py notify_expired_survey_deadlines
  python manage.py notify_expired_survey_deadlines --dry-run
  python manage.py notify_expired_survey_deadlines --survey-id 12
"""

from django.core.management.base import BaseCommand

from apps.surveys.services.deadline_notifications import notify_expired_deadlines


class Command(BaseCommand):
    help = "List/notify survey responses with expired deadlines via FCM"

    def add_arguments(self, parser):
        parser.add_argument("--survey-id", type=int, default=None)
        parser.add_argument("--submitted-user-id", type=int, default=None)
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List expired rows only; do not send FCM",
        )

    def handle(self, *args, **options):
        result = notify_expired_deadlines(
            survey_id=options.get("survey_id"),
            submitted_user_id=options.get("submitted_user_id"),
            send_notification=not options["dry_run"],
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"expired={result['response_count']} "
                f"notifications_sent={result.get('notifications_sent', 0)} "
                f"fcm_tokens_matched={result.get('fcm_tokens_matched', 0)}"
            )
        )
