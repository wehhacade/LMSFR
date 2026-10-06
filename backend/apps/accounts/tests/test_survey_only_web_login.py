"""Web login must not issue JWTs to survey-only field users without a mobile client."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserType
from apps.accounts.services.mobile_login_policy import MOBILE_LOGIN_REQUIRED_DETAIL

User = get_user_model()


class SurveyOnlyWebLoginBlockTests(APITestCase):
    def setUp(self):
        self.survey_type = UserType.objects.create(name="survey-mobile")
        self.field_user = User.objects.create_user(
            username="survey_field",
            email="survey_field@test.local",
            password="testpass123",
            is_active=True,
            is_mobile=True,
            user_type=self.survey_type,
        )
        self.agent_user = User.objects.create_user(
            username="survey_agent",
            email="survey_agent@test.local",
            password="testpass123",
            is_active=True,
            is_mobile=True,
            is_agent=True,
            user_type=self.survey_type,
        )

    def test_web_login_blocks_survey_only_user(self):
        res = self.client.post(
            reverse("token_obtain"),
            {"email": self.field_user.email, "password": "testpass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res.data["detail"], MOBILE_LOGIN_REQUIRED_DETAIL)

    def test_web_login_allows_survey_only_user_with_mobile_client(self):
        res = self.client.post(
            reverse("token_obtain"),
            {"email": self.field_user.email, "password": "testpass123", "client": "mobile"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)

    def test_web_login_allows_survey_mobile_agent(self):
        res = self.client.post(
            reverse("token_obtain"),
            {"email": self.agent_user.email, "password": "testpass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
