"""Tests for survey permission enforcement."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.surveys.models import Question, Survey, SurveySection

User = get_user_model()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


class SurveyPermissionTestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="perm_admin",
            email="perm_admin@test.local",
            password="testpass123",
            is_admin=True,
            is_active=True,
        )
        self.officer = User.objects.create_user(
            username="perm_officer",
            email="perm_officer@test.local",
            password="testpass123",
            is_active=True,
        )
        view_perm = Permission.objects.get(codename="view_survey")
        self.officer.user_permissions.add(view_perm)

        self.readonly_user = User.objects.create_user(
            username="perm_readonly",
            email="perm_readonly@test.local",
            password="testpass123",
            is_active=True,
        )

        self.survey = Survey.objects.create(
            name="Permission Test Survey",
            status=Survey.Status.LIVE,
            created_by=self.admin,
        )

    def _auth(self, user):
        token = get_tokens_for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_admin_can_list(self):
        self._auth(self.admin)
        response = self.client.get(reverse("survey-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_can_create(self):
        self._auth(self.admin)
        data = {"name": "Admin Survey", "status": "draft"}
        response = self.client.post(reverse("survey-list"), data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_officer_with_view_perm_can_list(self):
        self._auth(self.officer)
        response = self.client.get(reverse("survey-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_officer_with_view_perm_cannot_create(self):
        self._auth(self.officer)
        data = {"name": "Officer Survey", "status": "draft"}
        response = self.client.post(reverse("survey-list"), data, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_without_perms_cannot_list(self):
        self._auth(self.readonly_user)
        response = self.client.get(reverse("survey-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_survey_mobile_user_can_list_and_submit_without_view_perm(self):
        from apps.accounts.models import UserType

        survey_type = UserType.objects.create(name="survey-mobile")
        field_user = User.objects.create_user(
            username="survey_field_perm",
            email="survey_field_perm@test.local",
            password="testpass123",
            is_active=True,
            is_agent=True,
            is_admin=False,
            user_type=survey_type,
        )
        section = SurveySection.objects.create(survey=self.survey, title="S1", order=0)
        question = Question.objects.create(
            section=section,
            text="Name",
            qtype=Question.QType.SHORT,
            required=True,
            order=0,
        )
        self._auth(field_user)
        list_resp = self.client.get(reverse("survey-list"))
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        submit_resp = self.client.post(
            reverse("survey-response-list"),
            {
                "survey": self.survey.pk,
                "phone_number": "555000222",
                "answers": [{"question": question.pk, "value_text": "Field"}],
            },
            format="json",
        )
        self.assertEqual(submit_resp.status_code, status.HTTP_201_CREATED)
        create_resp = self.client.post(
            reverse("survey-list"),
            {"name": "Blocked", "status": "draft"},
            format="json",
        )
        self.assertEqual(create_resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_officer_with_view_perm_can_submit_response(self):
        section = SurveySection.objects.create(survey=self.survey, title="S1", order=0)
        question = Question.objects.create(
            section=section,
            text="Name",
            qtype=Question.QType.SHORT,
            required=True,
            order=0,
        )
        self._auth(self.officer)
        url = reverse("survey-response-list")
        response = self.client.post(
            url,
            {
                "survey": self.survey.pk,
                "phone_number": "555000111",
                "answers": [{"question": question.pk, "value_text": "Test"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"], self.officer.pk)

    def test_suspended_user_denied(self):
        self.admin.suspend = True
        self.admin.save()
        self._auth(self.admin)
        response = self.client.get(reverse("survey-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_analytics_requires_view_survey(self):
        self._auth(self.readonly_user)
        response = self.client.get(reverse("survey-analytics-responses-by-survey"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_officer_with_view_perm_can_access_analytics(self):
        self._auth(self.officer)
        response = self.client.get(reverse("survey-analytics-responses-by-survey"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
