"""Tests for Response CRUD endpoints."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import County, Region
from apps.surveys.models import Answer, Question, Response, Survey, SurveySection

User = get_user_model()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


class ResponseAPITestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="resp_admin",
            email="resp_admin@test.local",
            password="testpass123",
            is_admin=True,
            is_active=True,
        )
        self.token = get_tokens_for_user(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

        self.survey = Survey.objects.create(
            name="Response Test Survey",
            status=Survey.Status.LIVE,
            created_by=self.admin,
        )
        self.response_obj = Response.objects.create(
            survey=self.survey,
            phone_number="123456789",
        )

    def test_list_responses_returns_200(self):
        url = reverse("survey-response-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)

    def test_list_responses_contains_survey_name(self):
        url = reverse("survey-response-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first = response.data["results"][0]
        self.assertIn("survey_name", first)

    def test_list_uses_linked_user_phone_and_searches_full_name(self):
        respondent = User.objects.create_user(
            username="faysal",
            email="faysal@test.local",
            password="testpass123",
            first_name="Faysal Abdi",
            last_name="Warsame",
            phone="615123456",
        )
        linked_response = Response.objects.create(
            survey=self.survey,
            user=respondent,
            phone_number="000000000",
        )

        response = self.client.get(
            reverse("survey-response-list"),
            {"search": "Faysal Abdi Warsame"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        row = response.data["results"][0]
        self.assertEqual(row["id"], linked_response.pk)
        self.assertEqual(row["user_name"], "Faysal Abdi Warsame")
        self.assertEqual(row["respondent_phone"], "615123456")

    def test_retrieve_response_has_answers(self):
        url = reverse("survey-response-detail", kwargs={"pk": self.response_obj.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("answers", response.data)

    def test_owners_lists_magaca_milkilaha_answers(self):
        section = SurveySection.objects.create(survey=self.survey, title="Owners", order=0)
        owner_question = Question.objects.create(
            section=section,
            text="MAGACA MILKILAHA",
            qtype=Question.QType.SHORT,
            order=1,
        )
        camera_question = Question.objects.create(
            section=section,
            text="KAAMIRO MA XIRAN TAHAY",
            qtype=Question.QType.SINGLE,
            order=5,
        )
        from apps.surveys.models import Choice

        maya = Choice.objects.create(question=camera_question, label="MAYA", value="maya", order=0)
        other_question = Question.objects.create(
            section=section,
            text="OTHER QUESTION",
            qtype=Question.QType.SHORT,
            order=2,
        )
        Answer.objects.create(
            response=self.response_obj,
            question=owner_question,
            value_text="Amina Hassan",
        )
        camera_answer = Answer.objects.create(
            response=self.response_obj,
            question=camera_question,
        )
        camera_answer.choices.add(maya)
        Answer.objects.create(
            response=Response.objects.create(survey=self.survey, phone_number="555"),
            question=other_question,
            value_text="Not an owner",
        )

        response = self.client.get(reverse("survey-response-owners"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["owner_name"], "Amina Hassan")
        self.assertEqual(response.data["results"][0]["camera_installed"], "MAYA")
        self.assertEqual(response.data["results"][0]["response"], self.response_obj.pk)

    def test_owners_searches_owner_name(self):
        section = SurveySection.objects.create(survey=self.survey, title="Owners", order=0)
        question = Question.objects.create(
            section=section,
            text="MAGACA MILKILAHA",
            qtype=Question.QType.SHORT,
            order=1,
        )
        Answer.objects.create(
            response=self.response_obj,
            question=question,
            value_text="Amina Hassan",
        )

        response = self.client.get(reverse("survey-response-owners"), {"search": "Amina"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_owners_filters_by_camera_maya(self):
        section = SurveySection.objects.create(survey=self.survey, title="Owners", order=0)
        owner_question = Question.objects.create(
            section=section,
            text="MAGACA MILKILAHA",
            qtype=Question.QType.SHORT,
            order=1,
        )
        camera_question = Question.objects.create(
            section=section,
            text="KAAMIRO MA XIRAN TAHAY",
            qtype=Question.QType.SINGLE,
            order=5,
        )
        from apps.surveys.models import Choice

        maya = Choice.objects.create(question=camera_question, label="MAYA", value="maya", order=0)
        haa = Choice.objects.create(question=camera_question, label="HAA", value="haa", order=1)

        Answer.objects.create(
            response=self.response_obj,
            question=owner_question,
            value_text="Amina Hassan",
        )
        camera_answer = Answer.objects.create(
            response=self.response_obj,
            question=camera_question,
        )
        camera_answer.choices.add(maya)

        other = Response.objects.create(survey=self.survey, phone_number="999")
        Answer.objects.create(response=other, question=owner_question, value_text="Other Owner")
        other_camera = Answer.objects.create(response=other, question=camera_question)
        other_camera.choices.add(haa)

        response = self.client.get(reverse("survey-response-owners"), {"camera": "maya"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["owner_name"], "Amina Hassan")
        self.assertEqual(response.data["results"][0]["camera_installed"], "MAYA")

    def test_owners_filters_by_district_and_camera_summary(self):
        region = Region.objects.create(name="Banaadir")
        hodan = County.objects.create(name="Hodan", region=region)
        waberi = County.objects.create(name="Waberi", region=region)
        section = SurveySection.objects.create(survey=self.survey, title="Owners", order=0)
        owner_question = Question.objects.create(
            section=section,
            text="MAGACA MILKILAHA",
            qtype=Question.QType.SHORT,
            order=1,
        )
        camera_question = Question.objects.create(
            section=section,
            text="KAAMIRO MA XIRAN TAHAY",
            qtype=Question.QType.SINGLE,
            order=5,
        )
        from apps.surveys.models import Choice

        maya = Choice.objects.create(question=camera_question, label="MAYA", value="maya", order=0)
        haa = Choice.objects.create(question=camera_question, label="HAA", value="haa", order=1)

        self.response_obj.county = hodan
        self.response_obj.save(update_fields=["county"])
        Answer.objects.create(
            response=self.response_obj,
            question=owner_question,
            value_text="Amina Hassan",
        )
        hodan_camera = Answer.objects.create(response=self.response_obj, question=camera_question)
        hodan_camera.choices.add(maya)

        other = Response.objects.create(survey=self.survey, phone_number="999", county=waberi)
        Answer.objects.create(response=other, question=owner_question, value_text="Other Owner")
        other_camera = Answer.objects.create(response=other, question=camera_question)
        other_camera.choices.add(haa)

        same_district = Response.objects.create(survey=self.survey, phone_number="888", county=hodan)
        Answer.objects.create(response=same_district, question=owner_question, value_text="Hodan Owner")
        same_camera = Answer.objects.create(response=same_district, question=camera_question)
        same_camera.choices.add(haa)

        response = self.client.get(reverse("survey-response-owners"), {"county": hodan.pk})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        summary = response.data["summary"]
        self.assertEqual(summary["total"], 2)
        self.assertEqual(summary["haa"], 1)
        self.assertEqual(summary["maya"], 1)
        self.assertEqual(summary["county_name"], "Hodan")

        maya_only = self.client.get(
            reverse("survey-response-owners"),
            {"county": hodan.pk, "camera": "maya"},
        )
        self.assertEqual(maya_only.data["count"], 1)
        self.assertEqual(maya_only.data["summary"]["haa"], 1)
        self.assertEqual(maya_only.data["summary"]["maya"], 1)

    def test_create_response(self):
        url = reverse("survey-response-list")
        data = {
            "survey": self.survey.pk,
            "phone_number": "987654321",
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["phone_number"], "987654321")

    def test_filter_by_survey(self):
        other_survey = Survey.objects.create(name="Other Survey", status=Survey.Status.LIVE)
        Response.objects.create(survey=other_survey, phone_number="111")
        url = reverse("survey-response-list")
        response = self.client.get(url, {"survey": self.survey.pk})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for r in response.data["results"]:
            self.assertEqual(r["survey"], self.survey.pk)

    def test_delete_response_not_allowed_for_admin_without_dev(self):
        """Regular is_admin (non-superuser, non-Dev) cannot delete responses."""
        admin_only = User.objects.create_user(
            username="resp_admin_only",
            email="resp_admin_only@test.local",
            password="testpass123",
            is_admin=True,
            is_active=True,
            is_superuser=False,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(admin_only)}")
        url = reverse("survey-response-detail", kwargs={"pk": self.response_obj.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Response.objects.filter(pk=self.response_obj.pk).exists())

    def test_superuser_can_delete_response(self):
        superuser = User.objects.create_user(
            username="resp_super",
            email="resp_super@test.local",
            password="testpass123",
            is_superuser=True,
            is_active=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(superuser)}")
        url = reverse("survey-response-detail", kwargs={"pk": self.response_obj.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Response.objects.filter(pk=self.response_obj.pk).exists())

    def test_dev_user_can_delete_response(self):
        from apps.accounts.models import UserType

        dev_type, _ = UserType.objects.get_or_create(name="Dev")
        developer = User.objects.create_user(
            username="resp_dev",
            email="resp_dev@test.local",
            password="testpass123",
            is_active=True,
            is_superuser=False,
            is_admin=False,
            user_type=dev_type,
        )
        target = Response.objects.create(survey=self.survey, phone_number="del-dev-target")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(developer)}")
        url = reverse("survey-response-detail", kwargs={"pk": target.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Response.objects.filter(pk=target.pk).exists())

    def test_unauthenticated_returns_401(self):
        self.client.credentials()
        url = reverse("survey-response-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_response_rejects_draft_survey(self):
        draft = Survey.objects.create(name="Draft Survey", status=Survey.Status.DRAFT)
        url = reverse("survey-response-list")
        response = self.client.post(url, {"survey": draft.pk, "phone_number": "555"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)
        self.assertTrue(response.data["message"])

    def test_create_response_rejects_duplicate_single_submit(self):
        survey = Survey.objects.create(
            name="Single Submit Survey",
            status=Survey.Status.LIVE,
            allow_multiple_submissions=False,
        )
        Response.objects.create(survey=survey, phone_number="111222333")
        url = reverse("survey-response-list")
        response = self.client.post(
            url,
            {"survey": survey.pk, "phone_number": "111222333"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)
        self.assertIn("horay", response.data["message"].lower())

    def test_list_response_includes_completion_status(self):
        url = reverse("survey-response-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first = response.data["results"][0]
        self.assertIn("completion_status", first)
        self.assertIn("answer_count", first)

    def test_list_and_owners_filter_by_deadline_status(self):
        from datetime import timedelta

        from django.utils import timezone

        section = SurveySection.objects.create(survey=self.survey, title="Owners", order=0)
        owner_q = Question.objects.create(
            section=section,
            text="MAGACA MILKILAHA",
            qtype=Question.QType.SHORT,
            order=1,
        )
        expired = Response.objects.create(
            survey=self.survey,
            phone_number="expired-deadline",
            deadline_duration=timedelta(days=1),
        )
        Response.objects.filter(pk=expired.pk).update(
            submitted_at=timezone.now() - timedelta(days=5),
        )
        upcoming = Response.objects.create(
            survey=self.survey,
            phone_number="upcoming-deadline",
            deadline_duration=timedelta(days=10),
        )
        Answer.objects.create(response=expired, question=owner_q, value_text="Expired Owner")
        Answer.objects.create(response=upcoming, question=owner_q, value_text="Upcoming Owner")

        expired_list = self.client.get(reverse("survey-response-list"), {"deadline": "expired"})
        self.assertEqual(expired_list.status_code, status.HTTP_200_OK)
        expired_ids = {row["id"] for row in expired_list.data["results"]}
        self.assertIn(expired.pk, expired_ids)
        self.assertNotIn(upcoming.pk, expired_ids)
        expired_row = next(row for row in expired_list.data["results"] if row["id"] == expired.pk)
        self.assertTrue(expired_row["is_deadline_expired"])
        self.assertIsNotNone(expired_row["deadline_at"])
        self.assertLess(expired_row["deadline_days_remaining"], 0)

        upcoming_list = self.client.get(reverse("survey-response-list"), {"deadline": "upcoming"})
        upcoming_ids = {row["id"] for row in upcoming_list.data["results"]}
        self.assertIn(upcoming.pk, upcoming_ids)
        self.assertNotIn(expired.pk, upcoming_ids)

        owners_expired = self.client.get(reverse("survey-response-owners"), {"deadline": "expired"})
        self.assertEqual(owners_expired.status_code, status.HTTP_200_OK)
        owner_names = {row["owner_name"] for row in owners_expired.data["results"]}
        self.assertIn("Expired Owner", owner_names)
        self.assertNotIn("Upcoming Owner", owner_names)
        owner_row = next(row for row in owners_expired.data["results"] if row["owner_name"] == "Expired Owner")
        self.assertTrue(owner_row["is_deadline_expired"])
        self.assertIn("deadline_days_remaining", owner_row)

    def test_retrieve_response_includes_file_fields(self):
        url = reverse("survey-response-detail", kwargs={"pk": self.response_obj.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for field in ("identity_file", "photo", "navigation_url", "deadline_at"):
            self.assertIn(field, response.data)

    def test_create_response_requires_required_answers(self):
        section = SurveySection.objects.create(survey=self.survey, title="S1", order=0)
        question = Question.objects.create(
            section=section,
            text="Required question",
            qtype=Question.QType.SHORT,
            required=True,
            order=0,
        )
        url = reverse("survey-response-list")
        response = self.client.post(url, {"survey": self.survey.pk, "phone_number": "999"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("answers", response.data)
        self.assertIn("message", response.data)
        self.assertIn("Required question", response.data["message"])

        response = self.client.post(
            url,
            {
                "survey": self.survey.pk,
                "phone_number": "999",
                "answers": [{"question": question.pk, "value_text": "yes"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_response_rejects_empty_answers_when_required(self):
        section = SurveySection.objects.create(survey=self.survey, title="S1", order=0)
        Question.objects.create(
            section=section,
            text="Required question",
            qtype=Question.QType.SHORT,
            required=True,
            order=0,
        )
        url = reverse("survey-response-list")
        response = self.client.post(
            url,
            {"survey": self.survey.pk, "phone_number": "empty-answers"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("answers", response.data)
        self.assertIn("message", response.data)
        self.assertTrue(len(response.data["message"]) > 10)

    def test_create_response_multipart_with_file_and_answers_json(self):
        import json

        from django.core.files.uploadedfile import SimpleUploadedFile

        section = SurveySection.objects.create(survey=self.survey, title="S1", order=0)
        question = Question.objects.create(
            section=section,
            text="Photo question",
            qtype=Question.QType.SHORT,
            required=True,
            order=0,
        )
        url = reverse("survey-response-list")
        response = self.client.post(
            url,
            {
                "survey": self.survey.pk,
                "phone_number": "multipart-test",
                "answers": json.dumps([{"question": question.pk, "value_text": "yes"}]),
                "photo": SimpleUploadedFile("photo.jpg", b"fake-image", content_type="image/jpeg"),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(response.data["photo"])

    def test_create_response_multipart_with_single_choice(self):
        import json

        from django.core.files.uploadedfile import SimpleUploadedFile

        from apps.surveys.models import Choice

        section = SurveySection.objects.create(survey=self.survey, title="S1", order=0)
        question = Question.objects.create(
            section=section,
            text="Choice question",
            qtype=Question.QType.SINGLE,
            required=True,
            order=0,
        )
        choice = Choice.objects.create(question=question, label="Yes", value="yes", order=0)
        url = reverse("survey-response-list")
        response = self.client.post(
            url,
            {
                "survey": self.survey.pk,
                "phone_number": "multipart-choice",
                "answers": json.dumps(
                    [{"question": question.pk, "choice_ids": [choice.pk]}],
                ),
                "sawirka_guriga": SimpleUploadedFile(
                    "house.jpg", b"fake-image", content_type="image/jpeg",
                ),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["answer_count"], 1)
        self.assertEqual(response.data["completion_status"], "complete")
        self.assertEqual(len(response.data["answers"]), 1)
        self.assertEqual(response.data["answers"][0]["choices"][0]["label"], "Yes")
