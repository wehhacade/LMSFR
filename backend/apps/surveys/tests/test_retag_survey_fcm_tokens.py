"""Tests for retag_survey_fcm_tokens management command."""

from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.accounts.models import UserType
from apps.suspects.fcm import APP_SURVEY
from apps.suspects.models import FCMToken

User = get_user_model()


class RetagSurveyFcmTokensCommandTests(TestCase):
    def setUp(self):
        self.survey_type = UserType.objects.create(name="survey-mobile")
        self.survey_user = User.objects.create_user(
            username="survey_retag",
            email="survey_retag@test.local",
            password="testpass123",
            is_active=True,
            user_type=self.survey_type,
        )
        self.agent_user = User.objects.create_user(
            username="survey_agent_retag",
            email="survey_agent_retag@test.local",
            password="testpass123",
            is_active=True,
            is_agent=True,
            user_type=self.survey_type,
        )
        FCMToken.objects.create(
            user=self.survey_user,
            fcm_token="survey-user-token",
            app_slug=FCMToken.AppSlug.ILAALO,
        )
        FCMToken.objects.create(
            user=self.agent_user,
            fcm_token="agent-user-token",
            app_slug=FCMToken.AppSlug.ILAALO,
        )

    def test_dry_run_does_not_update(self):
        out = StringIO()
        call_command("retag_survey_fcm_tokens", "--dry-run", stdout=out)
        row = FCMToken.objects.get(fcm_token="survey-user-token")
        self.assertEqual(row.app_slug, FCMToken.AppSlug.ILAALO)
        self.assertIn("would retag 1 token", out.getvalue())

    def test_retags_survey_only_users(self):
        call_command("retag_survey_fcm_tokens")
        survey_row = FCMToken.objects.get(fcm_token="survey-user-token")
        agent_row = FCMToken.objects.get(fcm_token="agent-user-token")
        self.assertEqual(survey_row.app_slug, APP_SURVEY)
        self.assertEqual(agent_row.app_slug, FCMToken.AppSlug.ILAALO)

    def test_user_id_filter(self):
        call_command("retag_survey_fcm_tokens", user_id=self.survey_user.pk)
        self.assertEqual(
            FCMToken.objects.get(fcm_token="survey-user-token").app_slug,
            APP_SURVEY,
        )
        self.assertEqual(
            FCMToken.objects.get(fcm_token="agent-user-token").app_slug,
            FCMToken.AppSlug.ILAALO,
        )
