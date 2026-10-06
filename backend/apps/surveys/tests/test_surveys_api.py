"""Tests for Survey CRUD and stats endpoints."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.surveys.models import Survey

User = get_user_model()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


class SurveyAPITestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="survey_admin",
            email="survey_admin@test.local",
            password="testpass123",
            is_admin=True,
            is_active=True,
        )
        self.token = get_tokens_for_user(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

        self.survey = Survey.objects.create(
            name="Test Survey",
            description="A test survey",
            status=Survey.Status.LIVE,
            created_by=self.admin,
        )

    def test_list_surveys_returns_200(self):
        url = reverse("survey-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("count", response.data)

    def test_list_surveys_contains_response_count(self):
        url = reverse("survey-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first = response.data["results"][0]
        self.assertIn("response_count", first)
        self.assertIn("section_count", first)

    def test_retrieve_survey_returns_sections(self):
        url = reverse("survey-detail", kwargs={"pk": self.survey.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("sections", response.data)
        self.assertEqual(response.data["name"], "Test Survey")

    def test_question_payload_exposes_required_and_is_required_alias(self):
        from apps.surveys.models import Question, SurveySection

        section = SurveySection.objects.create(survey=self.survey, title="S1", order=0)
        optional = Question.objects.create(
            section=section,
            text="TALEEFANKA DAMIINKA",
            qtype=Question.QType.SHORT,
            required=False,
            order=0,
        )
        required_q = Question.objects.create(
            section=section,
            text="MAGACA MILKILAHA",
            qtype=Question.QType.SHORT,
            required=True,
            order=1,
        )
        url = reverse("survey-detail", kwargs={"pk": self.survey.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        by_id = {
            q["id"]: q
            for sec in response.data["sections"]
            for q in sec["questions"]
        }
        self.assertFalse(by_id[optional.pk]["required"])
        self.assertFalse(by_id[optional.pk]["is_required"])
        self.assertTrue(by_id[required_q.pk]["required"])
        self.assertTrue(by_id[required_q.pk]["is_required"])

    def test_reorder_questions_persists_order(self):
        from apps.surveys.models import Question, SurveySection

        section = SurveySection.objects.create(survey=self.survey, title="S1", order=0)
        q1 = Question.objects.create(
            section=section, text="Q1", qtype=Question.QType.SHORT, required=True, order=0
        )
        q2 = Question.objects.create(
            section=section, text="Q2", qtype=Question.QType.SHORT, required=True, order=1
        )
        q3 = Question.objects.create(
            section=section, text="Q3", qtype=Question.QType.SHORT, required=True, order=2
        )
        url = reverse("survey-question-reorder")
        response = self.client.post(
            url,
            {
                "section": section.pk,
                "questions": [
                    {"id": q3.pk, "order": 0},
                    {"id": q1.pk, "order": 1},
                    {"id": q2.pk, "order": 2},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            list(Question.objects.filter(section=section).order_by("order").values_list("id", flat=True)),
            [q3.pk, q1.pk, q2.pk],
        )
        detail = self.client.get(reverse("survey-detail", kwargs={"pk": self.survey.pk}))
        texts = [q["text"] for q in detail.data["sections"][0]["questions"]]
        self.assertEqual(texts, ["Q3", "Q1", "Q2"])

    def test_create_survey(self):
        url = reverse("survey-list")
        data = {"name": "New Survey", "description": "desc", "status": "draft"}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "New Survey")
        self.assertIn("sections", response.data)

    def test_partial_update_survey(self):
        url = reverse("survey-detail", kwargs={"pk": self.survey.pk})
        response = self.client.patch(url, {"status": "closed"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "closed")

    def test_delete_survey(self):
        url = reverse("survey-detail", kwargs={"pk": self.survey.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Survey.objects.filter(pk=self.survey.pk).exists())

    def test_stats_endpoint(self):
        url = reverse("survey-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_surveys", response.data)
        self.assertIn("live_surveys", response.data)
        self.assertIn("total_responses", response.data)

    def test_search_filter(self):
        Survey.objects.create(name="Another one", status=Survey.Status.DRAFT)
        url = reverse("survey-list")
        response = self.client.get(url, {"search": "Test"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [s["name"] for s in response.data["results"]]
        self.assertIn("Test Survey", names)
        self.assertNotIn("Another one", names)

    def test_status_filter(self):
        url = reverse("survey-list")
        response = self.client.get(url, {"status": "live"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for s in response.data["results"]:
            self.assertEqual(s["status"], "live")

    def test_unauthenticated_returns_401(self):
        self.client.credentials()
        url = reverse("survey-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
