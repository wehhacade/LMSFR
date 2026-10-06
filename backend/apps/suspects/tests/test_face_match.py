"""Tests for face-match and suspect-lookup endpoints."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.suspects.face_service import normalize_vector, store_suspect_embedding
from apps.suspects.models import Suspect, SuspectFaceEmbedding, SuspectStatus

from .base import create_admin_user

User = get_user_model()


class FaceMatchApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_admin_user(email="face-match@lmsbr.local")

    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.status, _ = SuspectStatus.objects.get_or_create(name="Shaki")
        self.suspect = Suspect.objects.create(
            name="Test Person",
            mother_name="Hooyo",
            phone="0612345678",
            district="Hodan",
            case_ref="FACE-TEST-001",
            last_seen="2026-01-01",
            offense="—",
            suspect_type=self.status,
        )
        self.vector = normalize_vector([float(i % 7) + 0.1 for i in range(192)])
        store_suspect_embedding(suspect_id=self.suspect.pk, vector=self.vector)

    def test_suspect_lookup_found(self):
        resp = self.client.post(
            "/api/v3/suspect-lookup",
            {"phone": "0612345678"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["isError"])
        self.assertTrue(resp.data["found"])
        self.assertEqual(resp.data["suspect_id"], self.suspect.id)

    def test_suspect_lookup_finds_wanted(self):
        from apps.mobile.models import WantedPerson

        wanted = WantedPerson.objects.create(
            full_name="Wanted Person",
            phone="0615333333",
            wanted_status="active",
            priority="high",
        )
        resp = self.client.post(
            "/api/v3/suspect-lookup",
            {"phone": "615333333"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["found"])
        sources = [m.get("source") for m in resp.data["matches"]]
        self.assertIn("wanted", sources)
        self.assertEqual(resp.data["matches"][0]["source"], "wanted")
        self.assertEqual(resp.data["matches"][0]["status"], "Wanted")
        self.assertEqual(resp.data["matches"][0]["wanted_id"], wanted.id)
        self.assertTrue(Suspect.objects.filter(pk=resp.data["matches"][0]["id"]).exists())

    def test_suspect_lookup_9_digit_matches_10_digit_store(self):
        resp = self.client.post(
            "/api/v3/suspect-lookup",
            {"phone": "612345678"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["found"])
        self.assertEqual(resp.data["suspect_id"], self.suspect.id)

    def test_suspect_lookup_not_found(self):
        resp = self.client.post(
            "/api/v3/suspect-lookup",
            {"phone": "0699999999"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["found"])

    def test_face_match_found(self):
        resp = self.client.post(
            "/api/v3/face-match",
            {"vector": self.vector, "threshold": 0.55},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["found"])
        self.assertEqual(resp.data["matches"][0]["id"], self.suspect.id)

    def test_face_match_marks_linked_suspect_as_wanted_without_changing_score(self):
        from apps.mobile.models import WantedPerson

        wanted = WantedPerson.objects.create(
            full_name=self.suspect.name,
            phone=self.suspect.phone,
            wanted_status="active",
            priority="high",
        )
        resp = self.client.post(
            "/api/v3/face-match",
            {"vector": self.vector, "threshold": 0.85},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["found"])
        match = resp.data["matches"][0]
        self.assertEqual(match["id"], self.suspect.id)
        self.assertEqual(match["wanted_id"], wanted.id)
        self.assertEqual(match["source"], "wanted")
        self.assertEqual(match["status"], "Wanted")
        self.assertEqual(match["match_distance"], 0.0)
        self.assertEqual(match["match_score"], 100.0)

    def test_suspect_list_name_search_includes_wanted_in_same_pagination(self):
        from apps.mobile.models import WantedPerson

        wanted = WantedPerson.objects.create(
            full_name="Liiska Wanted",
            phone="0615444444",
            wanted_status="active",
            priority="high",
        )
        resp = self.client.post(
            "/api/v3/suspect-list",
            {"user_id": self.user.pk, "page": 1, "searchQuery": "Liiska Wanted"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["isError"])
        match = next(row for row in resp.data["Message"] if row.get("wanted_id") == wanted.id)
        self.assertEqual(match["source"], "wanted")
        self.assertEqual(match["status"], "Wanted")
        self.assertTrue(Suspect.objects.filter(pk=match["id"]).exists())
        self.assertIn("total_pages", resp.data)
        self.assertIn("current_page", resp.data)

    def test_face_match_invalid_vector(self):
        resp = self.client.post(
            "/api/v3/face-match",
            {"vector": [1, 2, 3]},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["isError"])

    def test_face_embedding_store(self):
        other = Suspect.objects.create(
            name="Other",
            mother_name="Hooyo",
            phone="0611111111",
            district="Hodan",
            case_ref="FACE-TEST-002",
            last_seen="2026-01-01",
            offense="—",
            suspect_type=self.status,
        )
        vec = normalize_vector([0.5] * 192)
        resp = self.client.post(
            "/api/v3/face-embedding",
            {"suspect_id": other.id, "vector": vec, "vector_hash": "abc"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertFalse(resp.data["isError"])
        self.assertTrue(SuspectFaceEmbedding.objects.filter(suspect_id=other.id).exists())


def _jpeg_b64() -> str:
    import base64
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (48, 48), "red").save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


INSIGHTFACE_TEST_SETTINGS = {
    "INSIGHTFACE_ENABLED": True,
    "INSIGHTFACE_BASE_URL": "http://insightface.test",
    "INSIGHTFACE_API_KEY": "ifk_test",
    "INSIGHTFACE_SUSPECTS_COLLECTION": "lmsbr-suspects",
}


class InsightFaceSuspectApiTests(APITestCase):
    """TipPhone / RN keep /face-match and /face-embedding; photos go to InsightFace."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="insightface_tester",
            email="insightface-match@lmsbr.local",
            password="testpass12345",
            is_admin=True,
            is_active=True,
        )

    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.status, _ = SuspectStatus.objects.get_or_create(name="Shaki")
        self.suspect = Suspect.objects.create(
            name="Insight Person",
            mother_name="Hooyo",
            phone="0612345699",
            district="Hodan",
            case_ref="FACE-INSIGHT-001",
            last_seen="2026-01-01",
            offense="—",
            suspect_type=self.status,
        )
        self.vector = normalize_vector([float(i % 7) + 0.1 for i in range(192)])
        store_suspect_embedding(suspect_id=self.suspect.pk, vector=self.vector)

    @override_settings(**INSIGHTFACE_TEST_SETTINGS)
    def test_photo_match_uses_insightface(self):
        row = {"id": self.suspect.id, "name": self.suspect.name, "match_score": 86.4}
        with patch(
            "apps.suspects.face_views.search_suspects_by_image",
            return_value=([row], {"query_source": "insightface", "request_id": "req-1"}),
        ) as search:
            resp = self.client.post(
                "/api/v3/face-match",
                {"image": _jpeg_b64()},
                format="json",
            )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(resp.data["found"])
        self.assertEqual(resp.data["matches"][0]["id"], self.suspect.id)
        self.assertEqual(resp.data["meta"]["query_source"], "insightface")
        search.assert_called_once()

    @override_settings(**INSIGHTFACE_TEST_SETTINGS)
    def test_vector_match_skips_insightface(self):
        with patch("apps.suspects.face_views.search_suspects_by_image") as search:
            resp = self.client.post(
                "/api/v3/face-match",
                {"vector": self.vector, "threshold": 0.55},
                format="json",
            )
        search.assert_not_called()
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(resp.data["found"])
        self.assertEqual(resp.data["matches"][0]["id"], self.suspect.id)

    @override_settings(**INSIGHTFACE_TEST_SETTINGS)
    def test_insightface_outage_falls_back_to_local_gallery(self):
        from apps.suspects.insightface.client import InsightFaceUnavailable

        with patch(
            "apps.suspects.face_views.search_suspects_by_image",
            side_effect=InsightFaceUnavailable("down"),
        ), patch(
            "apps.suspects.face_views.embed_image_bytes",
            return_value=self.vector,
        ):
            resp = self.client.post(
                "/api/v3/face-match",
                {"image": _jpeg_b64()},
                format="json",
            )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(resp.data["found"])
        self.assertEqual(resp.data["matches"][0]["id"], self.suspect.id)
        self.assertEqual(resp.data["meta"].get("query_source"), "image_fallback")

    @override_settings(**INSIGHTFACE_TEST_SETTINGS)
    def test_face_embedding_enrolls_insightface(self):
        with patch(
            "apps.suspects.face_views.enroll_suspect_image",
            return_value={"ok": True, "person_id": f"suspect-{self.suspect.id}", "request_id": "enroll-1"},
        ) as enroll:
            resp = self.client.post(
                "/api/v3/face-embedding",
                {"suspect_id": self.suspect.id, "image": _jpeg_b64()},
                format="json",
            )
        enroll.assert_called_once()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertFalse(resp.data["isError"])
        self.assertEqual(resp.data["suspect_id"], self.suspect.id)


class InsightFacePersonIdTests(APITestCase):
    def test_parse_suspect_id(self):
        from apps.suspects.insightface.service import parse_suspect_id, person_id_for_suspect

        self.assertEqual(person_id_for_suspect(42), "suspect-42")
        self.assertEqual(parse_suspect_id("suspect-42"), 42)
        self.assertEqual(parse_suspect_id("99"), 99)
        self.assertEqual(parse_suspect_id("suspect-7", {"suspect_id": 7}), 7)
        self.assertIsNone(parse_suspect_id("alice"))
