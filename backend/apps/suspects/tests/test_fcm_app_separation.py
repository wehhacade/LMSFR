"""FCM push must stay scoped per mobile app (Ilaalo Shacab vs Survey)."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import UserType
from apps.suspects.fcm import APP_ILAALO, APP_SURVEY, broadcast_push
from apps.suspects.models import FCMToken

User = get_user_model()


def auth(user):
    return str(RefreshToken.for_user(user).access_token)


class FcmAppSeparationTests(APITestCase):
    def setUp(self):
        self.ilaalo_user = User.objects.create_user(
            username="ilaalo_agent",
            email="ilaalo@test.local",
            password="testpass123",
            is_active=True,
            is_agent=True,
        )
        self.survey_type = UserType.objects.create(name="survey-mobile")
        self.survey_user = User.objects.create_user(
            username="survey_only",
            email="survey_only@test.local",
            password="testpass123",
            is_active=True,
            is_mobile=True,
            user_type=self.survey_type,
        )

    def test_save_token_to_backend_tags_ilaalo(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {auth(self.ilaalo_user)}")
        res = self.client.post(
            reverse("root-save-fcm-token"),
            {"token": "ilaalo-device-token"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        row = FCMToken.objects.get(fcm_token="ilaalo-device-token")
        self.assertEqual(row.app_slug, FCMToken.AppSlug.ILAALO)

    def test_survey_save_fcm_token_tags_survey(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {auth(self.survey_user)}")
        res = self.client.post(
            reverse("survey-save-fcm-token"),
            {"fcm_token": "survey-device-token"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        row = FCMToken.objects.get(fcm_token="survey-device-token")
        self.assertEqual(row.app_slug, FCMToken.AppSlug.SURVEY)

    @patch("apps.suspects.fcm.send_push_to_token", return_value=True)
    def test_broadcast_push_skips_survey_tokens(self, send_mock):
        FCMToken.objects.create(
            user=self.ilaalo_user,
            fcm_token="ilaalo-broadcast-token",
            app_slug=FCMToken.AppSlug.ILAALO,
        )
        FCMToken.objects.create(
            user=self.survey_user,
            fcm_token="survey-broadcast-token",
            app_slug=FCMToken.AppSlug.SURVEY,
        )

        sent, failed = broadcast_push(title="Test", body="Body", app_slug=APP_ILAALO)

        self.assertEqual(sent, 1)
        self.assertEqual(failed, 0)
        send_mock.assert_called_once()
        self.assertEqual(send_mock.call_args.kwargs["token"], "ilaalo-broadcast-token")

    @patch("apps.suspects.fcm.send_push_to_token", return_value=True)
    def test_token_re_register_moves_app_slug(self, _send_mock):
        FCMToken.objects.create(
            user=self.survey_user,
            fcm_token="shared-device-token",
            app_slug=FCMToken.AppSlug.SURVEY,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {auth(self.ilaalo_user)}")
        res = self.client.post(
            reverse("root-save-fcm-token"),
            {"token": "shared-device-token"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        row = FCMToken.objects.get(fcm_token="shared-device-token")
        self.assertEqual(row.user_id, self.ilaalo_user.pk)
        self.assertEqual(row.app_slug, FCMToken.AppSlug.ILAALO)
