"""Root-level legacy API tests (/api/v3/get-county, etc.)."""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.suspects.models import Damiinada, Suspect, SuspectCase

from apps.suspects.tests.base import (
    create_admin_user,
    create_location_fixtures,
    create_suspect,
    create_suspect_status,
    seed_relationships,
)

User = get_user_model()


class RootLegacyLookupTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed_relationships()
        cls.user = create_admin_user(email="root-legacy@lmsbr.local")
        cls.loc = create_location_fixtures()

    def setUp(self):
        self.client.force_authenticate(user=self.user)

    def test_get_county_at_root(self):
        response = self.client.get("/api/v3/get-county")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["isError"])
        names = [row["name"] for row in response.data["Message"]]
        self.assertIn("Hodan", names)

    def test_get_county_taliye_degmo_own_county_only(self):
        from apps.accounts.models import County, UserType

        other = County.objects.create(name="Kaaraan", code="KR", region=self.loc["region"])
        ut, _ = UserType.objects.get_or_create(
            name="taliye_degmo", defaults={"code": "TD"}
        )
        commander = User.objects.create_user(
            username="td-hodan",
            email="td-hodan@lmsbr.local",
            password="test-pass",
            user_type=ut,
            county=self.loc["county"],
        )
        self.client.force_authenticate(user=commander)

        response = self.client.get("/api/v3/get-county")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["isError"])
        ids = [row["id"] for row in response.data["Message"]]
        names = [row["name"] for row in response.data["Message"]]
        self.assertEqual(ids, [self.loc["county"].id])
        self.assertEqual(names, ["Hodan"])
        self.assertNotIn(other.id, ids)

    def test_get_county_taliye_degmo_without_county_returns_empty(self):
        from apps.accounts.models import UserType

        ut, _ = UserType.objects.get_or_create(
            name="taliye_degmo", defaults={"code": "TD"}
        )
        commander = User.objects.create_user(
            username="td-none",
            email="td-none@lmsbr.local",
            password="test-pass",
            user_type=ut,
            county=None,
        )
        self.client.force_authenticate(user=commander)

        response = self.client.get("/api/v3/get-county")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["isError"])
        self.assertEqual(response.data["Message"], [])

    def test_get_relationships_at_root(self):
        response = self.client.get("/api/v3/get-relationships")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["isError"])
        self.assertEqual(len(response.data["Message"]), 10)

    def test_get_sub_county_by_legacy_county_id(self):
        legacy_id = self.loc["county"].id
        response = self.client.get("/api/v3/get-sub-county", {"county": str(legacy_id)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [row["name"] for row in response.data["Message"]]
        self.assertIn("Kacaan", names)


class RootLegacyDamiinTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed_relationships()
        cls.user = create_admin_user(email="root-damiin@lmsbr.local")
        cls.loc = create_location_fixtures()
        cls.status = create_suspect_status()

    def setUp(self):
        self.client.force_authenticate(user=self.user)

    def test_damiin_info_and_cases_at_root(self):
        suspect = Suspect.objects.create(
            name="Root Damiin Suspect",
            district="Hodan",
            case_ref="ROOT-DM-1",
            last_seen=date.today(),
            offense="—",
            suspect_type=self.status,
            capture_county=self.loc["county"],
            capture_sub_county=self.loc["sub_county"],
            created_by=self.user,
        )
        damiin = Damiinada.objects.create(
            name="Root Damiin",
            phone="611000300",
            county=self.loc["county"],
            relationship="Walaal",
            new_relationship_id=1,
            created_by=self.user,
        )
        SuspectCase.objects.create(
            suspect=suspect,
            damiin=damiin,
            tuhunka=self.status,
            capture_county=self.loc["county"],
            capture_sub_county=self.loc["sub_county"],
            description="root test",
            created_by=self.user,
        )

        info = self.client.get(f"/api/v3/get-Damiinada-info/{damiin.pk}")
        self.assertEqual(info.status_code, status.HTTP_200_OK)
        self.assertFalse(info.data["isError"])
        self.assertEqual(info.data["Message"]["name"], "Root Damiin")
        self.assertEqual(len(info.data["Message"]["suspects"]), 1)

        cases = self.client.get(f"/api/v3/get-damiin-cases/{damiin.pk}")
        self.assertEqual(cases.status_code, status.HTTP_200_OK)
        self.assertFalse(cases.data["isError"])
        self.assertEqual(cases.data["Message"][0]["d_qabashada"], "Hodan")

        dhamaan = self.client.get("/api/v3/get-dhamaan-Damiinada")
        self.assertEqual(dhamaan.status_code, status.HTTP_200_OK)
        self.assertFalse(dhamaan.data["isError"])
        self.assertTrue(any(row["name"] == "Root Damiin" for row in dhamaan.data["Message"]))

    def test_damiin_list_and_info_include_suspect_picture(self):
        from django.contrib.auth.models import Permission

        perm = Permission.objects.get(codename="view_suspectcase")
        self.user.user_permissions.add(perm)
        self.user = type(self.user).objects.get(pk=self.user.pk)
        self.client.force_authenticate(user=self.user)

        photo = "https://cdn.example.com/suspects/face.jpg"
        suspect = Suspect.objects.create(
            name="Photo List Suspect",
            district="Hodan",
            case_ref="ROOT-DM-PIC",
            last_seen=date.today(),
            offense="—",
            suspect_type=self.status,
            capture_county=self.loc["county"],
            capture_sub_county=self.loc["sub_county"],
            photo_url=photo,
            created_by=self.user,
        )
        damiin = Damiinada.objects.create(
            name="Photo List Damiin",
            phone="611000301",
            county=self.loc["county"],
            relationship="Walaal",
            new_relationship_id=1,
            picture_url="https://cdn.example.com/damiin/hero.jpg",
            created_by=self.user,
        )
        SuspectCase.objects.create(
            suspect=suspect,
            damiin=damiin,
            tuhunka=self.status,
            capture_county=self.loc["county"],
            capture_sub_county=self.loc["sub_county"],
            description="picture list test",
            created_by=self.user,
        )

        info = self.client.get(f"/api/v3/get-Damiinada-info/{damiin.pk}")
        self.assertEqual(info.status_code, status.HTTP_200_OK)
        info_row = info.data["Message"]["suspects"][0]
        self.assertEqual(info_row["suspect_id"], suspect.pk)
        self.assertEqual(info_row["picture"], photo)
        self.assertTrue(str(info_row["picture"]).startswith("https://"))

        listed = self.client.post(
            "/api/v3/get-damiin-list",
            {"page": 1, "searchQuery": "Photo List Damiin"},
            format="json",
        )
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertFalse(listed.data["isError"])
        match = next(row for row in listed.data["Message"] if row["id"] == damiin.pk)
        self.assertEqual(match["picture"], "https://cdn.example.com/damiin/hero.jpg")
        self.assertTrue(str(match["picture"]).startswith("https://"))
        self.assertEqual(match["suspects"][0]["suspect_id"], suspect.pk)
        self.assertEqual(match["suspects"][0]["name"], "Photo List Suspect")
        self.assertEqual(match["suspects"][0]["degmada"], "Hodan")
        self.assertEqual(match["suspects"][0]["picture"], photo)
        self.assertTrue(str(match["suspects"][0]["picture"]).startswith("https://"))


class TopAdminPagePeriodStatsTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed_relationships()
        cls.loc = create_location_fixtures()
        cls.status = create_suspect_status()
        cls.admin = User.objects.create_superuser(
            username="top_admin",
            email="top-admin@lmsbr.local",
            password="testpass12345",
            county=cls.loc["county"],
        )
        cls.county_user = User.objects.create_user(
            username="hodan_user",
            email="hodan-user@lmsbr.local",
            password="testpass12345",
            county=cls.loc["county"],
            is_active=True,
        )
        cls.old_user = User.objects.create_user(
            username="old_hodan_user",
            email="old-hodan-user@lmsbr.local",
            password="testpass12345",
            county=cls.loc["county"],
            is_active=True,
        )
        User.objects.filter(pk=cls.old_user.pk).update(
            date_joined=timezone.now() - timedelta(days=10),
        )

        cls.suspect_today = create_suspect(
            county=cls.loc["county"],
            sub_county=cls.loc["sub_county"],
            status=cls.status,
            user=cls.county_user,
            name="Today Suspect",
        )
        cls.suspect_old = create_suspect(
            county=cls.loc["county"],
            sub_county=cls.loc["sub_county"],
            status=cls.status,
            user=cls.county_user,
            name="Old Suspect",
        )
        Suspect.objects.filter(pk=cls.suspect_old.pk).update(
            created_at=timezone.now() - timedelta(days=10),
        )

        cls.case_today = SuspectCase.objects.create(
            suspect=cls.suspect_today,
            case_code="TOP-ADM-1",
            tuhunka=cls.status,
            capture_county=cls.loc["county"],
            capture_sub_county=cls.loc["sub_county"],
            created_by=cls.county_user,
        )
        cls.case_old = SuspectCase.objects.create(
            suspect=cls.suspect_old,
            case_code="TOP-ADM-2",
            tuhunka=cls.status,
            capture_county=cls.loc["county"],
            capture_sub_county=cls.loc["sub_county"],
            created_by=cls.county_user,
        )
        SuspectCase.objects.filter(pk=cls.case_old.pk).update(
            created_at=timezone.now() - timedelta(days=10),
        )

    def setUp(self):
        self.client.force_authenticate(user=self.admin)

    def test_top_admin_page_includes_period_stats(self):
        response = self.client.post(
            "/api/v3/top-admin-page",
            {"user_id": self.admin.pk, "page": 1},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["isError"])

        hodan = next(row for row in response.data["Message"] if row["name"] == "Hodan")
        self.assertEqual(hodan["user_county"], 3)
        self.assertEqual(hodan["total_suspect"], 2)
        self.assertEqual(hodan["total_cases"], 2)

        self.assertEqual(hodan["all"], {"users": 3, "suspects": 2, "cases": 2})
        # Users: total degmo count in every bucket; suspects/cases vary by period.
        for period in ("daily", "weekly", "monthly", "all"):
            self.assertEqual(hodan[period]["users"], 3)
        self.assertEqual(hodan["daily"]["suspects"], 1)
        self.assertEqual(hodan["daily"]["cases"], 1)
        self.assertEqual(hodan["weekly"], {"users": 3, "suspects": 1, "cases": 1})
        self.assertEqual(hodan["monthly"], {"users": 3, "suspects": 2, "cases": 2})
