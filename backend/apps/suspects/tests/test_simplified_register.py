"""Tests for simplified register-complete endpoint."""

from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.suspects.models import Damiinada, Suspect, SuspectCase

from .base import (
    create_admin_user,
    create_location_fixtures,
    create_suspect_status,
    seed_relationships,
)


def _jpeg(name: str = "photo.jpg") -> SimpleUploadedFile:
    buf = BytesIO()
    Image.new("RGB", (48, 48), color="blue").save(buf, format="JPEG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/jpeg")


class RegisterCompleteTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed_relationships()
        cls.user = create_admin_user(email="register-complete@lmsbr.local")
        cls.loc = create_location_fixtures()
        cls.status = create_suspect_status()

    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.county_id = str(self.loc["county"].pk)
        self.sub_id = str(self.loc["sub_county"].pk)

    def _payload(self, **overrides):
        data = {
            "fullname": "Axmed Faarax Ali",
            "mother": "Sahra Faarax",
            "phone": "0611223344",
            "gender": "Lab",
            "identity_card": "ID-9001",
            "occupation": "Ganacsade",
            "address_county": self.county_id,
            "suspect_type": self.status.pk,
            "capture_county": self.county_id,
            "capture_sub_county": self.sub_id,
            "faahfaahin": "Tuhun hub leh",
            "doorasho": "new_damiin",
            "damiin_name": "Maxamed Damiin",
            "damiin_gender": "Lab",
            "damiin_phone": "0619988776",
            "relationship": 1,
            "damiin_county": self.county_id,
            "picture": _jpeg("suspect.jpg"),
            "damiin_identity_picture": _jpeg("id.jpg"),
        }
        data.update(overrides)
        return data

    def test_register_complete_creates_all_rows(self):
        before_cases = SuspectCase.objects.count()
        resp = self.client.post(
            "/api/v3/suspect/register-complete",
            self._payload(),
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertFalse(resp.data["isError"])
        self.assertEqual(SuspectCase.objects.count(), before_cases + 1)

        suspect = Suspect.objects.get(pk=resp.data["suspect_id"])
        self.assertEqual(suspect.name, "Axmed Faarax Ali")
        self.assertEqual(suspect.mother_name, "Sahra Faarax")
        self.assertEqual(suspect.phone, "0611223344")
        self.assertEqual(suspect.capture_county_id, self.loc["county"].pk)
        self.assertEqual(suspect.address_id, self.loc["county"].pk)
        suspect.refresh_from_db()
        self.assertFalse(suspect.is_released)
        self.assertEqual(suspect.status, Suspect.Status.ACTIVE)

        case = SuspectCase.objects.get(pk=resp.data["case_id"])
        self.assertEqual(case.suspect_id, suspect.pk)
        self.assertEqual(case.damiin_id, resp.data["damiin_id"])
        self.assertTrue(case.case_code)

        damiin = Damiinada.objects.get(pk=resp.data["damiin_id"])
        self.assertEqual(damiin.name, "Maxamed Damiin")
        self.assertEqual(damiin.gender, "Lab")
        self.assertEqual(damiin.phone, "0619988776")

    def test_register_complete_accepts_nine_digit_phone(self):
        resp = self.client.post(
            "/api/v3/suspect/register-complete",
            self._payload(phone="611223344", damiin_phone="619988776"),
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertFalse(resp.data["isError"])

        suspect = Suspect.objects.get(pk=resp.data["suspect_id"])
        self.assertEqual(suspect.phone, "0611223344")

        damiin = Damiinada.objects.get(pk=resp.data["damiin_id"])
        self.assertEqual(damiin.phone, "0619988776")

    def test_register_complete_root_path(self):
        resp = self.client.post(
            "/api/v3/register-complete",
            self._payload(fullname="Root Path Suspect", phone="0611334455", damiin_phone="0619776655"),
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertFalse(resp.data["isError"])

    def test_missing_picture_rejected(self):
        payload = self._payload()
        del payload["picture"]
        resp = self.client.post("/api/v3/suspect/register-complete", payload, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["isError"])

    def test_duplicate_suspect_rejected(self):
        self.client.post("/api/v3/suspect/register-complete", self._payload(), format="multipart")
        resp = self.client.post(
            "/api/v3/suspect/register-complete",
            self._payload(phone="0611445566", damiin_phone="0619665544"),
            format="multipart",
        )
        self.assertTrue(resp.data["isError"])
