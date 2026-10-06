"""Tests for survey FCM token + expired deadline notify endpoints."""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import UserType
from apps.suspects.models import FCMToken
from apps.surveys.models import Response, Survey

User = get_user_model()


def auth(user):
    return str(RefreshToken.for_user(user).access_token)


class SurveyFcmApiTests(APITestCase):
    def setUp(self):
        self.survey_type = UserType.objects.create(name="survey-mobile")
        self.agent = User.objects.create_user(
            username="survey_agent",
            email="survey_agent@test.local",
            password="testpass123",
            is_active=True,
            is_mobile=True,
            user_type=self.survey_type,
        )
        self.admin = User.objects.create_user(
            username="survey_admin",
            email="survey_admin@test.local",
            password="testpass123",
            is_admin=True,
            is_active=True,
        )
        self.survey = Survey.objects.create(
            name="Deadline Survey",
            status=Survey.Status.LIVE,
            created_by=self.admin,
        )

    def test_save_fcm_token_creates_row(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {auth(self.agent)}")
        url = reverse("survey-save-fcm-token")
        res = self.client.post(url, {"fcm_token": "device-token-abc"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            FCMToken.objects.filter(
                user=self.agent,
                fcm_token="device-token-abc",
                app_slug=FCMToken.AppSlug.SURVEY,
            ).exists()
        )

    def test_save_fcm_token_rejects_non_mobile(self):
        plain = User.objects.create_user(
            username="plain_user",
            email="plain@test.local",
            password="testpass123",
            is_active=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {auth(plain)}")
        url = reverse("survey-save-fcm-token")
        res = self.client.post(url, {"fcm_token": "x"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_expired_deadlines_lists_and_notifies(self):
        past = timezone.now() - timedelta(days=3)
        row = Response.objects.create(
            survey=self.survey,
            user=self.agent,
            phone_number="615000000",
            deadline_duration=timedelta(days=1),
        )
        Response.objects.filter(pk=row.pk).update(submitted_at=past)
        FCMToken.objects.create(
            user=self.agent,
            fcm_token="notify-token-1",
            app_slug=FCMToken.AppSlug.SURVEY,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {auth(self.admin)}")
        url = reverse("survey-expired-deadlines")
        with patch("apps.surveys.services.deadline_notifications.send_push_to_token", return_value=True) as send:
            res = self.client.post(url, {"send_notification": True}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["response_count"], 1)
        self.assertEqual(res.data["notifications_sent"], 1)
        send.assert_called_once()
        kwargs = send.call_args.kwargs
        self.assertEqual(kwargs["data_type"], "survey_deadline_expired")
        self.assertEqual(kwargs["data"]["response_id"], str(row.id))

    def test_expired_deadlines_ignores_ilaalo_tokens(self):
        past = timezone.now() - timedelta(days=3)
        row = Response.objects.create(
            survey=self.survey,
            user=self.agent,
            phone_number="615000001",
            deadline_duration=timedelta(days=1),
        )
        Response.objects.filter(pk=row.pk).update(submitted_at=past)
        FCMToken.objects.create(
            user=self.agent,
            fcm_token="ilaalo-only-token",
            app_slug=FCMToken.AppSlug.ILAALO,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {auth(self.admin)}")
        url = reverse("survey-expired-deadlines")
        with patch("apps.surveys.services.deadline_notifications.send_push_to_token", return_value=True) as send:
            res = self.client.post(url, {"send_notification": True}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["response_count"], 1)
        self.assertEqual(res.data["notifications_sent"], 0)
        send.assert_not_called()

    def test_create_response_accepts_deadline_days(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {auth(self.admin)}")
        url = reverse("survey-response-list")
        res = self.client.post(
            url,
            {
                "survey": self.survey.pk,
                "phone_number": "615111222",
                "deadline_days": 2,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Response.objects.get(pk=res.data["id"])
        self.assertEqual(created.deadline_duration, timedelta(days=2))
