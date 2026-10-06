"""Legacy + mobile suspect API integration tests."""

from datetime import date
from io import BytesIO
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.suspects.models import Damiinada, Suspect

from .base import (
    create_admin_user,
    create_location_fixtures,
    create_suspect_status,
    seed_relationships,
)


def _jpeg(name: str) -> SimpleUploadedFile:
    buf = BytesIO()
    Image.new("RGB", (48, 48), color="blue").save(buf, format="JPEG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/jpeg")


class LegacyLookupAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed_relationships()
        cls.user = create_admin_user()
        cls.loc = create_location_fixtures()

    def setUp(self):
        self.client.force_authenticate(user=self.user)

    def test_get_relationships(self):
        response = self.client.get("/api/v3/suspect/get-relationships")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["isError"])
        self.assertEqual(len(response.data["Message"]), 10)
        self.assertEqual(response.data["Message"][0]["name"], "Walaal")

    def test_get_region(self):
        response = self.client.get("/api/v3/suspect/get-region/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["isError"])
        names = [row["name"] for row in response.data["Message"]]
        self.assertIn("Banaadir", names)

    def test_address_list_by_region_legacy_id(self):
        response = self.client.get("/api/v3/suspect/address/", {"region": "1"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row["name"] == "Hodan" for row in response.data))

    def test_get_sub_county_by_county_id(self):
        county_id = self.loc["county"].pk
        response = self.client.get("/api/v3/suspect/get-sub-county/", {"county": county_id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["isError"])
        names = [row["name"] for row in response.data["Message"]]
        self.assertIn("Kacaan", names)

    def test_mobile_lookups_include_relationships_and_districts(self):
        response = self.client.get("/api/v3/suspect/mobile/lookups/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("relationships", response.data)
        self.assertIn("districts", response.data)
        self.assertIn("sub_counties", response.data)
        self.assertEqual(len(response.data["relationships"]), 10)


class LegacySuspectDamiinFlowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed_relationships()
        cls.user = create_admin_user(email="flow-test@lmsbr.local")
        cls.loc = create_location_fixtures()
        cls.status = create_suspect_status()

    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.county_id = str(self.loc["county"].pk)
        self.sub_county_id = str(self.loc["sub_county"].pk)

    def test_suspect_create_then_damiin_with_relationship(self):
        create_resp = self.client.post(
            "/api/v3/suspect/suspects-create",
            {
                "fullname": "Flow Suspect",
                "county": self.county_id,
                "sub_county": self.sub_county_id,
                "suspect_type": self.status.pk,
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        suspect_id = create_resp.data["id"]

        suspect = Suspect.objects.get(pk=suspect_id)
        self.assertEqual(suspect.capture_county_id, self.loc["county"].pk)
        self.assertEqual(suspect.capture_sub_county_id, self.loc["sub_county"].pk)

        damiin_resp = self.client.post(
            "/api/v3/suspect/create-damiinka-api",
            {
                "suspect_id": suspect_id,
                "names": "Flow Damiin",
                "phone": "611000100",
                "relationship": 4,
                "degmada_laga_qabtay": self.county_id,
                "damiin_sub_county": self.sub_county_id,
                "description": "Test flow",
            },
            format="json",
        )
        self.assertEqual(damiin_resp.status_code, status.HTTP_201_CREATED)
        self.assertFalse(damiin_resp.data["isError"])
        self.assertTrue(damiin_resp.data["case_code"].startswith("SC"))

        damiin = Damiinada.objects.get(phone="611000100")
        self.assertEqual(damiin.relationship, "Adeer")
        self.assertEqual(damiin.new_relationship_id, 4)
        self.assertEqual(damiin.county_id, self.loc["county"].pk)

        cases_resp = self.client.get(f"/api/v3/suspect/get-suspect-cases/{suspect_id}")
        self.assertEqual(cases_resp.status_code, status.HTTP_200_OK)
        case_row = cases_resp.data["Message"][0]
        self.assertEqual(case_row["d_qabashada"], "Hodan")
        self.assertEqual(case_row["w_qabashada"], "Kacaan")

        damiin_list = self.client.get(f"/api/v3/suspect/get-damiintayaasha/{suspect_id}")
        self.assertEqual(damiin_list.status_code, status.HTTP_200_OK)
        row = damiin_list.data["Message"][0]
        self.assertEqual(row["relationship"], "Adeer")
        self.assertEqual(row["relationship_id"], 4)
        self.assertEqual(row["degmada"], "Hodan")
        self.assertEqual(row["sub_county"], "Kacaan")
        self.assertIn("picture", row)

    def test_get_damiintayaasha_includes_picture_url(self):
        suspect = Suspect.objects.create(
            name="Picture Suspect",
            district="Hodan",
            case_ref="TST-PIC",
            last_seen=date.today(),
            offense="—",
            suspect_type=self.status,
            capture_county=self.loc["county"],
            capture_sub_county=self.loc["sub_county"],
            created_by=self.user,
        )
        damiin = Damiinada.objects.create(
            name="Picture Damiin",
            phone="611000777",
            county=self.loc["county"],
            relationship="Walaal",
            new_relationship_id=1,
            picture_url="https://cdn.example.com/damiin/face.jpg",
            created_by=self.user,
        )
        from apps.suspects.models import SuspectCase

        SuspectCase.objects.create(
            suspect=suspect,
            damiin=damiin,
            tuhunka=self.status,
            capture_county=self.loc["county"],
            capture_sub_county=self.loc["sub_county"],
            description="picture test",
            created_by=self.user,
        )

        for path in (
            f"/api/v3/get-damiintayaasha/{suspect.pk}",
            f"/api/v3/suspect/get-damiintayaasha/{suspect.pk}",
        ):
            response = self.client.get(path)
            self.assertEqual(response.status_code, status.HTTP_200_OK, path)
            self.assertFalse(response.data["isError"], path)
            row = response.data["Message"][0]
            self.assertIn("picture", row)
            self.assertEqual(row["picture"], "https://cdn.example.com/damiin/face.jpg")
            self.assertEqual(row["name"], "Picture Damiin")

    @patch("apps.suspects.services.schedule_photo_updates")
    def test_create_damiinka_api_schedules_both_photos(self, schedule_photos):
        suspect = Suspect.objects.create(
            name="Damiin Photo Suspect",
            district="Hodan",
            case_ref="TST-PHOTOS",
            last_seen=date.today(),
            offense="—",
            suspect_type=self.status,
            capture_county=self.loc["county"],
            capture_sub_county=self.loc["sub_county"],
            created_by=self.user,
        )
        response = self.client.post(
            "/api/v3/suspect/create-damiinka-api",
            {
                "suspect_id": suspect.pk,
                "names": "Damiin With Photos",
                "phone": "611000300",
                "relationship": 1,
                "degmada_laga_qabtay": self.county_id,
                "damiin_sub_county": self.sub_county_id,
                "damiin_picture": _jpeg("face.jpg"),
                "damiin_identity_picture": _jpeg("identity.jpg"),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        damiin = Damiinada.objects.get(phone="611000300")
        schedule_photos.assert_called_once()
        jobs = schedule_photos.call_args.args[0]
        self.assertEqual(
            {(entity, pk, field) for entity, pk, field, _upload in jobs},
            {
                ("damiin", damiin.pk, "picture_url"),
                ("damiin", damiin.pk, "identity_picture_url"),
            },
        )

    def test_web_guarantors_list_by_suspect(self):
        create_resp = self.client.post(
            "/api/v3/suspect/suspects-create",
            {
                "fullname": "Guarantor List Suspect",
                "county": self.county_id,
                "sub_county": self.sub_county_id,
                "suspect_type": self.status.pk,
            },
            format="json",
        )
        suspect_id = create_resp.data["id"]
        self.client.post(
            "/api/v3/suspect/create-damiinka-api",
            {
                "suspect_id": suspect_id,
                "names": "List API Damiin",
                "phone": "611000200",
                "relationship": 2,
                "degmada_laga_qabtay": self.county_id,
                "description": "list test",
            },
            format="json",
        )
        response = self.client.get("/api/v3/suspect/guarantors/", {"suspect": suspect_id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = response.data if isinstance(response.data, list) else response.data.get("results", [])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["relationship"], "Hooyo")
        self.assertEqual(rows[0]["relationship_name"], "Hooyo")

    def test_damiin_create_requires_relationship(self):
        suspect = Suspect.objects.create(
            name="No Rel Suspect",
            district="Hodan",
            case_ref="TST-NOREL",
            last_seen=date.today(),
            offense="—",
            suspect_type=self.status,
            capture_county=self.loc["county"],
            capture_sub_county=self.loc["sub_county"],
            created_by=self.user,
        )
        response = self.client.post(
            "/api/v3/suspect/create-damiinka-api",
            {
                "suspect_id": suspect.pk,
                "names": "Bad Damiin",
                "phone": "611000101",
                "degmada_laga_qabtay": self.county_id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("relationship", response.data)
