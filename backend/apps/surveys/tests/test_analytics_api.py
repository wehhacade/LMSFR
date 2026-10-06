"""Tests for analytics endpoints."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.cache import invalidate_cache
from apps.surveys.models import Response, Survey

User = get_user_model()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


class AnalyticsAPITestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="analytics_admin",
            email="analytics_admin@test.local",
            password="testpass123",
            is_admin=True,
            is_active=True,
        )
        self.token = get_tokens_for_user(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

        self.survey = Survey.objects.create(
            name="Analytics Survey",
            status=Survey.Status.LIVE,
            created_by=self.admin,
        )
        Response.objects.create(survey=self.survey, phone_number="111")
        Response.objects.create(survey=self.survey, phone_number="222")
        invalidate_cache("survey.analytics")

    def test_responses_by_survey_returns_200(self):
        url = reverse("survey-analytics-responses-by-survey")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_responses_by_survey_has_expected_keys(self):
        url = reverse("survey-analytics-responses-by-survey")
        response = self.client.get(url)
        if response.data:
            first = response.data[0]
            self.assertIn("name", first)
            self.assertIn("total", first)

    def test_completion_breakdown_returns_200(self):
        url = reverse("survey-analytics-completion-breakdown")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 2)

    def test_completion_breakdown_has_expected_labels(self):
        url = reverse("survey-analytics-completion-breakdown")
        response = self.client.get(url)
        labels = [item["label"] for item in response.data]
        self.assertIn("Completed", labels)
        self.assertIn("Partial", labels)
        self.assertNotIn("Abandoned", labels)
        for item in response.data:
            self.assertIn("count", item)
            self.assertIn("pct", item)

    def test_completion_breakdown_percentages_sum_to_100(self):
        url = reverse("survey-analytics-completion-breakdown")
        response = self.client.get(url, {"range": "30d"})
        total_pct = sum(item["pct"] for item in response.data)
        self.assertAlmostEqual(total_pct, 100.0, places=1)

    def test_daily_trend_returns_200(self):
        url = reverse("survey-analytics-daily-trend")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_daily_trend_has_date_and_count(self):
        url = reverse("survey-analytics-daily-trend")
        response = self.client.get(url, {"range": "7d"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 7)
        first = response.data[0]
        self.assertIn("date", first)
        self.assertIn("count", first)
        self.assertIn("label", first)

    def test_range_param_7d(self):
        url = reverse("survey-analytics-daily-trend")
        response = self.client.get(url, {"range": "7d"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 7)

    def test_range_param_30d(self):
        url = reverse("survey-analytics-daily-trend")
        response = self.client.get(url, {"range": "30d"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 30)

    def test_completion_breakdown_partial_without_answers(self):
        url = reverse("survey-analytics-completion-breakdown")
        response = self.client.get(url, {"range": "30d"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        by_label = {item["label"]: item for item in response.data}
        self.assertGreater(by_label["Partial"]["pct"], 0)
        self.assertAlmostEqual(
            by_label["Completed"]["pct"] + by_label["Partial"]["pct"],
            100.0,
            places=1,
        )

    def test_period_summary_returns_200(self):
        url = reverse("survey-analytics-period-summary")
        response = self.client.get(url, {"range": "30d"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_responses", response.data)
        self.assertIn("unique_respondents", response.data)
        self.assertIn("change_vs_previous_pct", response.data)

    def test_hourly_activity_returns_24_hours(self):
        url = reverse("survey-analytics-hourly-activity")
        response = self.client.get(url, {"range": "7d"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 24)

    def test_completion_trend_has_complete_and_partial(self):
        url = reverse("survey-analytics-completion-trend")
        response = self.client.get(url, {"range": "7d"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 7)
        first = response.data[0]
        self.assertIn("complete", first)
        self.assertIn("partial", first)
        self.assertIn("total", first)
        total_sum = sum(d["total"] for d in response.data)
        self.assertGreaterEqual(total_sum, 2)

    def test_top_respondents_returns_list(self):
        url = reverse("survey-analytics-top-respondents")
        response = self.client.get(url, {"range": "30d"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        if response.data:
            self.assertIn("display_name", response.data[0])
            self.assertIn("submission_count", response.data[0])

    def test_by_district_returns_list(self):
        url = reverse("survey-analytics-by-district")
        response = self.client.get(url, {"range": "30d"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_unauthenticated_returns_401(self):
        self.client.credentials()
        url = reverse("survey-analytics-responses-by-survey")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

