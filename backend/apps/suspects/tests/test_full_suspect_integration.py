"""
Hal test buuxa — suspect legacy API + damiin + dhammaan fields.

Daboolaya:
  lookups → create-suspect-api (fields buuxa + sawir) → suspects-create
  → suspect-list → single-suspect-data → get-suspect-list
  → damiin/cases → damiin info/list → web guarantors → mobile lookups
"""

from datetime import date
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Country
from apps.suspects.models import Damiinada, Suspect, SuspectCase

from .base import (
    create_admin_user,
    create_location_fixtures,
    create_suspect_status,
    seed_relationships,
)


def _test_picture() -> SimpleUploadedFile:
    buf = BytesIO()
    Image.new("RGB", (64, 64), color="red").save(buf, format="JPEG")
    buf.seek(0)
    return SimpleUploadedFile("suspect.jpg", buf.read(), content_type="image/jpeg")


class FullSuspectIntegrationTest(APITestCase):
    """Hal xabo test ah — dhameystiran."""

    @classmethod
    def setUpTestData(cls):
        seed_relationships()
        cls.user = create_admin_user(email="full-integration@lmsbr.local")
        cls.loc = create_location_fixtures()
        cls.status = create_suspect_status()
        cls.country = Country.objects.create(name="Somalia")

    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.county_legacy = str(self.loc["county"].id)
        self.sub_legacy = str(self.loc["sub_county"].id)
        self.county_uuid = str(self.loc["county"].pk)
        self.sub_uuid = str(self.loc["sub_county"].pk)

    def test_full_suspect_legacy_lifecycle(self):
        # ── 1. Lookups ──
        for path in (
            "/api/v3/get-county",
            "/api/v3/get-relationships",
            "/api/v3/suspect/get-region/",
            "/api/v3/suspect/get-suspect-status/",
        ):
            resp = self.client.get(path)
            self.assertEqual(resp.status_code, status.HTTP_200_OK, msg=path)
            self.assertFalse(resp.data.get("isError", False), msg=path)

        sub_resp = self.client.get("/api/v3/get-sub-county", {"county": self.county_legacy})
        self.assertTrue(any(r["name"] == "Kacaan" for r in sub_resp.data["Message"]))

        addr_resp = self.client.get("/api/v3/suspect/address/", {"region": "1"})
        self.assertTrue(any(r["name"] == "Hodan" for r in addr_resp.data))

        mobile_lk = self.client.get("/api/v3/suspect/mobile/lookups/")
        self.assertEqual(mobile_lk.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mobile_lk.data["relationships"]), 10)

        # ── 2. create-suspect-api (mobile buuxa + sawir) ──
        create_resp = self.client.post(
            "/api/v3/create-suspect-api",
            {
                "fullname": "Cali Axmed Maxamed",
                "mother": "Maryan Axmed",
                "nickname": "Cali",
                "dob": "1995-06-15",
                "pob": "Muqdisho",
                "gender": "Lab",
                "nationality": str(self.country.pk),
                "phone_self": "0612345678",
                "parent_phone": "0619876543",
                "marital": "Guursaday",
                "children": "2",
                "occupation": "Ganacsade",
                "place_occupation": "Bakaaro",
                "tribe": "Abgaal",
                "identity_card": "ID-12345",
                "county": self.county_legacy,
                "sub_county": self.sub_legacy,
                "suspect_type": self.status.pk,
                "description": "Tuhun argagixiso",
                "picture": _test_picture(),
            },
            format="multipart",
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        self.assertFalse(create_resp.data["isError"])
        suspect_id = create_resp.data["id"]

        suspect = Suspect.objects.get(pk=suspect_id)
        self.assertEqual(suspect.name, "Cali Axmed Maxamed")
        self.assertEqual(suspect.mother_name, "Maryan Axmed")
        self.assertEqual(suspect.alias, "Cali")
        self.assertEqual(suspect.date_of_birth, date(1995, 6, 15))
        self.assertEqual(suspect.goobta_dhalashada, "Muqdisho")
        self.assertEqual(suspect.gender, "Lab")
        self.assertEqual(suspect.phone, "0612345678")
        self.assertEqual(suspect.father_contact, "0619876543")
        self.assertEqual(suspect.marriage_status, "Guursaday")
        self.assertEqual(suspect.children, 2)
        self.assertEqual(suspect.occupation, "Ganacsade")
        self.assertEqual(suspect.goobta_shaqada, "Bakaaro")
        self.assertEqual(suspect.tribe, "Abgaal")
        self.assertEqual(suspect.lambarka_diiwaanka, "ID-12345")
        self.assertEqual(suspect.notes, "Tuhun argagixiso")
        self.assertEqual(suspect.nationality_id, self.country.pk)
        self.assertEqual(suspect.capture_county_id, self.loc["county"].pk)
        self.assertEqual(suspect.capture_sub_county_id, self.loc["sub_county"].pk)
        self.assertEqual(suspect.suspect_type_id, self.status.pk)
        self.assertEqual(suspect.created_by_id, self.user.pk)
        self.assertTrue(suspect.photo_url)
        self.assertTrue(suspect.date_opp)

        # ── 3. suspects-create (fudud) ──
        simple_resp = self.client.post(
            "/api/v3/suspects-create",
            {
                "fullname": "Simple Legacy Suspect",
                "county": self.county_uuid,
                "sub_county": self.sub_uuid,
                "suspect_type": self.status.pk,
            },
            format="json",
        )
        self.assertEqual(simple_resp.status_code, status.HTTP_201_CREATED)
        simple_id = simple_resp.data["id"]

        # ── 4. suspect-list ──
        list_resp = self.client.post(
            "/api/v3/suspect-list",
            {"user_id": self.user.pk, "page": 1, "searchQuery": "Cali"},
            format="json",
        )
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        row = next(r for r in list_resp.data["Message"] if r["id"] == suspect_id)
        self.assertEqual(row["mother"], "Maryan Axmed")
        self.assertEqual(row["tnumber"], "0612345678")
        self.assertEqual(row["occupation"], "Ganacsade")
        self.assertEqual(row["tribe"], "Abgaal")
        self.assertEqual(row["degmada"], "Hodan")

        # ── 5. single-suspect-data ──
        detail_resp = self.client.post(
            "/api/v3/single-suspect-data",
            {"user_id": self.user.pk, "suspect_id": suspect_id},
            format="json",
        )
        self.assertFalse(detail_resp.data["isError"])
        detail = detail_resp.data["Message"]
        self.assertEqual(detail["name"], "Cali Axmed Maxamed")
        self.assertEqual(detail["gender"], "Lab")
        self.assertEqual(detail["sub_county"], "Kacaan")

        # ── 6. get-suspect-list ──
        user_list = self.client.get("/api/v3/get-suspect-list/")
        self.assertFalse(user_list.data["isError"])
        self.assertIn(suspect_id, [r["id"] for r in user_list.data["Message"]])

        # ── 7. Legacy list GET ──
        legacy_list = self.client.get("/api/v3/suspects/")
        self.assertEqual(legacy_list.status_code, status.HTTP_200_OK)

        # ── 8. Damiin + cases ──
        damiin_resp = self.client.post(
            "/api/v3/create-damiinka-api",
            {
                "suspect_id": suspect_id,
                "names": "Integration Damiin",
                "phone": "0615551234",
                "relationship": 1,
                "degmada_laga_qabtay": self.county_uuid,
                "damiin_sub_county": self.sub_uuid,
                "description": "Integration damiin",
            },
            format="json",
        )
        self.assertEqual(damiin_resp.status_code, status.HTTP_201_CREATED)
        self.assertFalse(damiin_resp.data["isError"])
        self.assertTrue(damiin_resp.data["case_code"].startswith("SC"))

        damiin = Damiinada.objects.get(phone="0615551234")
        self.assertEqual(damiin.relationship, "Walaal")
        self.assertEqual(damiin.new_relationship_id, 1)
        self.assertEqual(damiin.county_id, self.loc["county"].pk)
        self.assertEqual(damiin.sub_county_id, self.loc["sub_county"].pk)

        cases_resp = self.client.get(f"/api/v3/get-suspect-cases/{suspect_id}")
        self.assertFalse(cases_resp.data["isError"])
        case_row = cases_resp.data["Message"][0]
        self.assertEqual(case_row["d_qabashada"], "Hodan")
        self.assertEqual(case_row["w_qabashada"], "Kacaan")

        damiin_list = self.client.get(f"/api/v3/get-damiintayaasha/{suspect_id}")
        self.assertFalse(damiin_list.data["isError"])
        self.assertEqual(damiin_list.data["Message"][0]["relationship"], "Walaal")

        damiin_info = self.client.get(f"/api/v3/get-Damiinada-info/{damiin.pk}")
        self.assertFalse(damiin_info.data["isError"])
        self.assertEqual(damiin_info.data["Message"]["name"], "Integration Damiin")

        damiin_cases = self.client.get(f"/api/v3/get-damiin-cases/{damiin.pk}")
        self.assertFalse(damiin_cases.data["isError"])
        self.assertEqual(len(damiin_cases.data["Message"]), 1)

        dhamaan = self.client.get("/api/v3/get-dhamaan-Damiinada")
        self.assertFalse(dhamaan.data["isError"])
        self.assertTrue(any(r["name"] == "Integration Damiin" for r in dhamaan.data["Message"]))

        suspect.refresh_from_db()
        self.assertGreaterEqual(suspect.bail_count, 1)

        # ── 9. Web REST ──
        web_detail = self.client.get(f"/api/v3/suspect/{suspect_id}/")
        self.assertEqual(web_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(web_detail.data["name"], "Cali Axmed Maxamed")

        guarantors = self.client.get("/api/v3/suspect/guarantors/", {"suspect": suspect_id})
        self.assertEqual(guarantors.status_code, status.HTTP_200_OK)
        rows = guarantors.data if isinstance(guarantors.data, list) else guarantors.data.get("results", [])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["relationship_name"], "Walaal")

        # ── 10. Mobile suspect detail ──
        mobile_detail = self.client.get(f"/api/v3/suspect/mobile/suspects/{suspect_id}/")
        self.assertEqual(mobile_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(mobile_detail.data["fullname"], "Cali Axmed Maxamed")
        self.assertEqual(mobile_detail.data["nickname"], "Cali")

        # ── Xeelad: labada suspect + hal case ──
        self.assertTrue(Suspect.objects.filter(pk=simple_id).exists())
        self.assertEqual(SuspectCase.objects.filter(suspect_id=suspect_id).count(), 1)
