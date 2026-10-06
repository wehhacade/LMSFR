"""Tests for survey respondent aggregation endpoints."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.surveys.models import Question, Response, Survey, SurveySection

User = get_user_model()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


class RespondentAPITestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="resp_settings_admin",
            email="resp_settings@test.local",
            password="testpass123",
            is_admin=True,
            is_active=True,
            first_name="Fatima",
            last_name="Ali",
        )
        self.token = get_tokens_for_user(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

        self.survey = Survey.objects.create(
            name="Settings Test Survey",
            status=Survey.Status.LIVE,
            created_by=self.admin,
        )
        section = SurveySection.objects.create(survey=self.survey, title="S1", order=0)
        Question.objects.create(
            section=section,
            text="Q1",
            qtype=Question.QType.SHORT,
            required=True,
            order=0,
        )

        self.user_response = Response.objects.create(
            survey=self.survey,
            user=self.admin,
            phone_number="111",
        )
        Response.objects.filter(pk=self.user_response.pk).update(
            submitted_at=timezone.now(),
        )

        Response.objects.create(
            survey=self.survey,
            phone_number="252611111111",
            latitude="2.046934",
            longitude="45.318161",
        )

    def test_map_endpoint_returns_gps_respondents(self):
        url = reverse("survey-respondent-map")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        pin = next(r for r in response.data if r["key"] == "phone:252611111111")
        self.assertEqual(pin["submission_count"], 1)
        self.assertIn("latitude", pin)
        self.assertIn("locations", pin)

    def test_list_respondents_returns_200(self):
        url = reverse("survey-respondent-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertGreaterEqual(len(response.data["results"]), 2)

    def test_summary_endpoint(self):
        url = reverse("survey-respondent-summary")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_respondents", response.data)

    def test_activity_lists_responses_for_respondent(self):
        key = "phone:252611111111"
        url = reverse("survey-respondent-activity", kwargs={"pk": key})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
