"""
One-time: re-tag FCM tokens as `survey` for survey-mobile users who are not agents.

Usage:
  python manage.py retag_survey_fcm_tokens --dry-run
  python manage.py retag_survey_fcm_tokens
  python manage.py retag_survey_fcm_tokens --user-id 42
"""

from django.core.management.base import BaseCommand, CommandError

from apps.suspects.fcm import APP_SURVEY
from apps.suspects.models import FCMToken
from apps.surveys.services.deadline_notifications import survey_only_user_queryset


class Command(BaseCommand):
    help = (
        "Re-tag FCM tokens as survey for survey-mobile users who are not Ilaalo agents. "
        "Safe to re-run; only updates tokens not already tagged survey."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many tokens would change; do not update.",
        )
        parser.add_argument(
            "--user-id",
            type=int,
            default=None,
            help="Limit to one survey-only user id.",
        )

    def handle(self, *args, **options):
        dry_run = bool(options["dry_run"])
        user_id = options.get("user_id")

        users = list(survey_only_user_queryset(user_id=user_id))
        if user_id is not None and not users:
            raise CommandError(
                f"User {user_id} is not a survey-mobile non-agent account "
                f"(user_type=survey-mobile and is_agent=False)."
            )

        user_ids = [u.pk for u in users]
        if not user_ids:
            self.stdout.write(self.style.WARNING("No survey-only users matched."))
            return

        tokens_qs = FCMToken.objects.filter(user_id__in=user_ids).select_related("user")
        to_retag = tokens_qs.exclude(app_slug=APP_SURVEY)
        already_survey = tokens_qs.filter(app_slug=APP_SURVEY).count()
        ilaalo_tokens = list(
            to_retag.values_list("id", "user_id", "user__username", "fcm_token", "app_slug")
        )

        self.stdout.write(
            f"survey_only_users={len(user_ids)} "
            f"tokens_total={tokens_qs.count()} "
            f"already_survey={already_survey} "
            f"to_retag={len(ilaalo_tokens)}"
        )

        if ilaalo_tokens and int(options.get("verbosity", 1)) >= 2:
            for tok_id, uid, username, fcm_token, app_slug in ilaalo_tokens[:50]:
                self.stdout.write(
                    f"  token_id={tok_id} user_id={uid} user={username} "
                    f"app_slug={app_slug} fcm={fcm_token[:20]}…"
                )
            if len(ilaalo_tokens) > 50:
                self.stdout.write(f"  … and {len(ilaalo_tokens) - 50} more")

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"Dry run — would retag {len(ilaalo_tokens)} token(s) to app_slug={APP_SURVEY}"
                )
            )
            return

        updated = to_retag.update(app_slug=APP_SURVEY)
        self.stdout.write(
            self.style.SUCCESS(
                f"Retagged {updated} FCM token(s) to app_slug={APP_SURVEY} "
                f"for {len(user_ids)} survey-only user(s)."
            )
        )
