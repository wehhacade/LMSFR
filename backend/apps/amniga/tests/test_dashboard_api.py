"""Tests for Amniga dashboard and analytics endpoints."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import County, Region
from apps.core.cache import invalidate_cache
from apps.forces.models import Force
from apps.suspects.models import Suspect

User = get_user_model()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


class AmnigaDashboardAPITestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="amniga_admin",
            email="amniga_admin@test.local",
            password="testpass123",
            is_admin=True,
            is_active=True,
        )
        self.token = get_tokens_for_user(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

        Force.objects.create(
            name="Officer One",
            badge_number="F-001",
            unit="Unit 07",
            district="Bakaaro",
            status=Force.Status.ON_DUTY,
        )
        Suspect.objects.create(
            name="Test Suspect",
            district="Hodan",
            case_ref="CASE-001",
            last_seen=timezone.now().date(),
            offense="Test",
        )
        invalidate_cache("amniga")

    def test_stats_returns_200(self):
        url = reverse("amniga-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("active_patrols", response.data)
        self.assertIn("guards_on_duty", response.data)
        self.assertEqual(response.data["guards_on_duty"], 1)

    def test_analytics_returns_200(self):
        url = reverse("amniga-analytics")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("weekly_trend", response.data)
        self.assertEqual(len(response.data["weekly_trend"]), 7)

    def test_analytics_30d_range(self):
        url = reverse("amniga-analytics")
        response = self.client.get(url, {"range": "30d"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["daily_trend"]), 30)

    def test_unauthenticated_returns_401(self):
        self.client.credentials()
        url = reverse("amniga-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_without_module_perm_returns_403(self):
        user = User.objects.create_user(
            username="no_amniga",
            email="no_amniga@test.local",
            password="testpass123",
            is_active=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(user)}")
        response = self.client.get(reverse("amniga-stats"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_with_agent_perm_can_access(self):
        user = User.objects.create_user(
            username="agent_viewer",
            email="agent_viewer@test.local",
            password="testpass123",
            is_active=True,
        )
        perm = Permission.objects.get(
            codename="view_agent",
            content_type=ContentType.objects.get(app_label="accounts", model="agent"),
        )
        user.user_permissions.add(perm)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(user)}")
        response = self.client.get(reverse("amniga-stats"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_stats_falls_back_to_agents_when_no_forces(self):
        from apps.accounts.models import Agent

        Force.objects.all().delete()
        Agent.objects.create(
            user=self.admin,
            service_id="AG-001",
            first_name="Agent",
            father_name="One",
            last_name="Test",
            fourth_name="User",
            mother_name="Mother",
            date_of_birth="1990-01-01",
            phone="612000001",
            present="Joogey",
            status="Active",
        )
        invalidate_cache("amniga")
        response = self.client.get(reverse("amniga-stats"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["guards_on_duty"], 1)
        self.assertEqual(response.data["active_patrols"], 1)

    def test_daily_report_returns_summary(self):
        today = timezone.localdate().isoformat()
        url = reverse("amniga-daily-report")
        response = self.client.get(url, {"date": today})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["date"], today)
        self.assertEqual(response.data["date_from"], today)
        self.assertEqual(response.data["date_to"], today)
        self.assertIn("summary", response.data)
        self.assertEqual(response.data["summary"]["suspects_registered"], 1)
        self.assertIn("capture_by_district", response.data)
        self.assertIn("residence_by_district", response.data)
        self.assertIn("district_activity", response.data)
        self.assertIn("top_registrars", response.data)
        self.assertIn("latest_comments", response.data)
        self.assertIn("latest_responses", response.data)
        self.assertIn("repeat_offenders", response.data)

    def test_daily_report_date_range(self):
        today = timezone.localdate()
        older = Suspect.objects.create(
            name="Older Suspect",
            district="Kaaraan",
            case_ref="CASE-OLD",
            last_seen=today - timedelta(days=5),
            offense="Test",
        )
        Suspect.objects.filter(pk=older.pk).update(created_at=timezone.now() - timedelta(days=5))
        invalidate_cache("amniga")
        url = reverse("amniga-daily-report")
        start = (today - timedelta(days=6)).isoformat()
        end = today.isoformat()
        response = self.client.get(url, {"date_from": start, "date_to": end})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["date_from"], start)
        self.assertEqual(response.data["date_to"], end)
        self.assertEqual(response.data["summary"]["suspects_registered"], 2)

    def test_daily_report_requires_report_permission(self):
        user = User.objects.create_user(
            username="agent_only_report",
            email="agent_only_report@test.local",
            password="testpass123",
            is_active=True,
        )
        perm = Permission.objects.get(
            codename="view_agent",
            content_type=ContentType.objects.get(app_label="accounts", model="agent"),
        )
        user.user_permissions.add(perm)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(user)}")
        response = self.client.get(reverse("amniga-daily-report"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_daily_report_with_view_daily_report_perm(self):
        user = User.objects.create_user(
            username="report_viewer",
            email="report_viewer@test.local",
            password="testpass123",
            is_active=True,
        )
        perm = Permission.objects.get(
            codename="view_daily_report",
            content_type=ContentType.objects.get(app_label="suspects", model="suspect"),
        )
        user.user_permissions.add(perm)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(user)}")
        response = self.client.get(reverse("amniga-daily-report"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["suspects_registered"], 1)

    def test_daily_report_district_activity_counties_only(self):
        region = Region.objects.create(name="Banaadir")
        hodan = County.objects.create(name="Hodan", region=region)
        County.objects.create(name="0000", region=region)
        registrar = User.objects.create_user(
            username="hodan_reg",
            email="hodan_reg@test.local",
            password="testpass123",
            first_name="Amina",
            last_name="Ali",
            is_active=True,
            county=hodan,
        )
        Suspect.objects.filter(case_ref="CASE-001").update(
            capture_county=hodan,
            created_by=registrar,
            district="Hodan",
        )
        Suspect.objects.create(
            name="Junk District Suspect",
            district="0000",
            case_ref="CASE-JUNK",
            last_seen=timezone.now().date(),
            offense="Test",
            created_by=registrar,
        )
        invalidate_cache("amniga")
        today = timezone.localdate().isoformat()
        response = self.client.get(reverse("amniga-daily-report"), {"date": today})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [row["name"] for row in response.data["district_activity"]]
        self.assertIn("Hodan", names)
        self.assertNotIn("0000", names)
        hodan_row = next(row for row in response.data["district_activity"] if row["name"] == "Hodan")
        self.assertGreaterEqual(hodan_row["suspects"], 1)
        self.assertIn("active_users", hodan_row)
        self.assertIn("share_pct", hodan_row)

    def test_daily_report_selected_district_keeps_selected_name(self):
        """Suspects matched via address must still show the selected district, not capture."""
        region = Region.objects.create(name="Banaadir")
        cabdi = County.objects.create(name="Cabdicasiis", region=region)
        boondheere = County.objects.create(name="Boondheere", region=region)
        Suspect.objects.filter(case_ref="CASE-001").update(
            capture_county=boondheere,
            address=cabdi,
            district="Boondheere",
        )
        invalidate_cache("amniga")
        today = timezone.localdate().isoformat()
        response = self.client.get(
            reverse("amniga-daily-report"),
            {"date": today, "district": "Cabdicasiis"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["suspects_registered"], 1)
        self.assertEqual(len(response.data["district_activity"]), 1)
        row = response.data["district_activity"][0]
        self.assertEqual(row["name"], "Cabdicasiis")
        self.assertEqual(row["suspects"], 1)
        names = [r["name"] for r in response.data["district_activity"]]
        self.assertNotIn("Boondheere", names)

    def test_daily_report_repeat_offenders_respect_date_and_district(self):
        region = Region.objects.create(name="Banaadir")
        cabdi = County.objects.create(name="Cabdicasiis", region=region)
        other = County.objects.create(name="Heliwaa", region=region)
        from apps.suspects.models import SuspectCase

        in_period = Suspect.objects.filter(case_ref="CASE-001").first()
        Suspect.objects.filter(pk=in_period.pk).update(
            capture_county=cabdi,
            address=cabdi,
            district="Cabdicasiis",
            created_at=timezone.now(),
        )
        SuspectCase.objects.create(suspect=in_period, case_code="C-1")
        SuspectCase.objects.create(suspect=in_period, case_code="C-2")

        old = Suspect.objects.create(
            name="Old Cabdi Repeat",
            district="Fekonle",
            case_ref="CASE-OLD-CABDI",
            last_seen=timezone.now().date(),
            offense="Test",
            capture_county=cabdi,
        )
        Suspect.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=40),
        )
        SuspectCase.objects.create(suspect=old, case_code="C-OLD-1")
        SuspectCase.objects.create(suspect=old, case_code="C-OLD-2")

        other_district = Suspect.objects.create(
            name="Other District Repeat",
            district="xamali",
            case_ref="CASE-OTHER",
            last_seen=timezone.now().date(),
            offense="Test",
            capture_county=other,
        )
        SuspectCase.objects.create(suspect=other_district, case_code="C-O-1")
        SuspectCase.objects.create(suspect=other_district, case_code="C-O-2")

        invalidate_cache("amniga")
        today = timezone.localdate().isoformat()
        response = self.client.get(
            reverse("amniga-daily-report"),
            {"date": today, "district": "Cabdicasiis"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in response.data["repeat_offenders"]]
        self.assertIn(in_period.pk, ids)
        self.assertNotIn(old.pk, ids)
        self.assertNotIn(other_district.pk, ids)

    def test_district_profile_returns_registrars(self):
        region = Region.objects.create(name="Banaadir")
        hodan = County.objects.create(name="Hodan", region=region)
        registrar = User.objects.create_user(
            username="profile_reg",
            email="profile_reg@test.local",
            password="testpass123",
            first_name="Hassan",
            last_name="Nur",
            phone="615000111",
            is_active=True,
            county=hodan,
        )
        Suspect.objects.filter(case_ref="CASE-001").update(
            capture_county=hodan,
            created_by=registrar,
            district="Hodan",
        )
        invalidate_cache("amniga")
        today = timezone.localdate().isoformat()
        response = self.client.get(
            reverse("amniga-district-profile"),
            {"district": "Hodan", "date": today},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["district"]["name"], "Hodan")
        self.assertGreaterEqual(response.data["summary"]["suspects_registered"], 1)
        self.assertGreaterEqual(len(response.data["top_registrars"]), 1)
        self.assertEqual(response.data["top_registrars"][0]["name"], "Hassan Nur")
        self.assertGreaterEqual(len(response.data["assigned_officers"]), 1)
        self.assertEqual(response.data["assigned_officers"][0]["district_registrations"], 1)
        self.assertIsNotNone(response.data["assigned_officers"][0]["last_login"])
        self.assertIsNotNone(response.data["top_registrars"][0]["last_login"])
        self.assertIn("recent_suspects", response.data)
        self.assertIn("trend", response.data)

    def test_district_profile_allows_agent_permission(self):
        """Shaqada Degmooyinka users (view_agent) can open district profiles."""
        user = User.objects.create_user(
            username="agent_district_profile",
            email="agent_district_profile@test.local",
            password="testpass123",
            is_active=True,
        )
        perm = Permission.objects.get(
            codename="view_agent",
            content_type=ContentType.objects.get(app_label="accounts", model="agent"),
        )
        user.user_permissions.add(perm)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(user)}")
        region = Region.objects.create(name="Banaadir Agent Profile")
        County.objects.create(name="Waaberi", region=region)
        response = self.client.get(
            reverse("amniga-district-profile"),
            {"district": "Waaberi", "date": timezone.localdate().isoformat()},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["district"]["name"], "Waaberi")

    def test_district_profile_suspect_count_matches_county_list(self):
        """Profile headline uses exclusive attribution like Shaqada Degmooyinka."""
        region = Region.objects.create(name="Banaadir Match")
        alpha = County.objects.create(name="AlphaDegmo", region=region)
        beta = County.objects.create(name="BetaDegmo", region=region)
        # Captured in Alpha, resident in Beta — list attributes to Alpha only.
        Suspect.objects.create(
            name="Exclusive Match Suspect",
            district=beta.name,
            case_ref="MATCH-EXCL-1",
            last_seen=timezone.localdate(),
            offense="Test",
            capture_county=alpha,
            address=beta,
        )
        invalidate_cache("amniga")
        today = timezone.localdate().isoformat()
        list_resp = self.client.get(
            reverse("amniga-district-tasks"),
            {"date_from": today, "date_to": today, "page_size": 50},
        )
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        by_name = {row["name"]: row["suspects"] for row in list_resp.data["results"]}
        alpha_profile = self.client.get(
            reverse("amniga-district-profile"),
            {"district": alpha.name, "date": today},
        )
        beta_profile = self.client.get(
            reverse("amniga-district-profile"),
            {"district": beta.name, "date": today},
        )
        self.assertEqual(alpha_profile.status_code, status.HTTP_200_OK)
        self.assertEqual(beta_profile.status_code, status.HTTP_200_OK)
        self.assertEqual(
            alpha_profile.data["summary"]["suspects_registered"],
            by_name.get(alpha.name, 0),
        )
        self.assertEqual(
            beta_profile.data["summary"]["suspects_registered"],
            by_name.get(beta.name, 0),
        )
        # Resident-here can still reflect Beta even though exclusive count is 0.
        self.assertGreaterEqual(beta_profile.data["summary"]["residence_count"], 1)
        self.assertEqual(beta_profile.data["summary"]["suspects_registered"], 0)

    def test_district_profile_requires_district(self):
        response = self.client.get(reverse("amniga-district-profile"))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_district_profile_unknown_district(self):
        response = self.client.get(
            reverse("amniga-district-profile"),
            {"district": "NotARealCounty"},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_reports_requires_agent_permission(self):
        user = User.objects.create_user(
            username="suspect_only_reports",
            email="suspect_only_reports@test.local",
            password="testpass123",
            is_active=True,
        )
        perm = Permission.objects.get(
            codename="view_suspect",
            content_type=ContentType.objects.get(app_label="suspects", model="suspect"),
        )
        user.user_permissions.add(perm)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(user)}")
        response = self.client.get(reverse("amniga-user-reports"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_reports_with_agent_permission(self):
        user = User.objects.create_user(
            username="agent_reports",
            email="agent_reports@test.local",
            password="testpass123",
            is_active=True,
        )
        perm = Permission.objects.get(
            codename="view_agent",
            content_type=ContentType.objects.get(app_label="accounts", model="agent"),
        )
        user.user_permissions.add(perm)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(user)}")
        response = self.client.get(reverse("amniga-user-reports"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_district_tasks_requires_agent_permission(self):
        user = User.objects.create_user(
            username="suspect_only_tasks",
            email="suspect_only_tasks@test.local",
            password="testpass123",
            is_active=True,
        )
        perm = Permission.objects.get(
            codename="view_suspect",
            content_type=ContentType.objects.get(app_label="suspects", model="suspect"),
        )
        user.user_permissions.add(perm)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(user)}")
        response = self.client.get(reverse("amniga-district-tasks"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_district_tasks_returns_period_activity(self):
        from apps.accounts.models import County, Region

        region = Region.objects.create(name="Banaadir")
        hodan = County.objects.create(name="Hodan", region=region)
        User.objects.create_user(
            username="hodan_user",
            email="hodan_user@test.local",
            password="testpass123",
            is_active=True,
            is_agent=True,
            county=hodan,
        )
        Suspect.objects.filter(case_ref="CASE-001").update(
            capture_county=hodan,
            district="Hodan",
        )
        invalidate_cache("amniga")
        today = timezone.localdate().isoformat()
        response = self.client.get(
            reverse("amniga-district-tasks"),
            {"date_from": today, "date_to": today, "page_size": 30},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["date_from"], today)
        self.assertEqual(response.data["date_to"], today)
        names = [row["name"] for row in response.data["results"]]
        self.assertIn("Hodan", names)
        hodan_row = next(row for row in response.data["results"] if row["name"] == "Hodan")
        self.assertGreaterEqual(hodan_row["suspects"], 1)
        self.assertIn("share_pct", hodan_row)
        self.assertIn("region", hodan_row)

    def test_user_track_map_lists_agents_markers_and_duty(self):
        from apps.accounts.models import Agent
        from apps.mobile.models import UserLocation

        on_duty = User.objects.create_user(
            username="MU2601062",
            email="gps_on@test.local",
            password="testpass123",
            first_name="Amina",
            last_name="Ali",
            is_agent=True,
            is_active=True,
            latitude="2.05",
            longitude="45.32",
        )
        off_duty = User.objects.create_user(
            username="1063",
            email="gps_off@test.local",
            password="testpass123",
            first_name="Omar",
            last_name="Nur",
            is_agent=True,
            is_active=True,
            latitude="2.10",
            longitude="45.40",
        )
        Agent.objects.create(
            user=on_duty,
            service_id="AG-GPS-1",
            first_name="Amina",
            father_name="X",
            last_name="Ali",
            fourth_name="Y",
            mother_name="Z",
            date_of_birth="1990-01-01",
            phone="612000101",
            present="Joogey",
            status="Active",
        )
        Agent.objects.create(
            user=off_duty,
            service_id="AG-GPS-2",
            first_name="Omar",
            father_name="X",
            last_name="Nur",
            fourth_name="Y",
            mother_name="Z",
            date_of_birth="1991-01-01",
            phone="612000102",
            present="Maqan",
            status="Active",
        )
        UserLocation.objects.create(
            user=on_duty,
            latitude=2.0469,
            longitude=45.3182,
            reg_day="2026-08-08",
            year="2026",
            month="08",
        )
        old = UserLocation.objects.create(
            user=off_duty,
            latitude=2.10,
            longitude=45.40,
            reg_day="2026-07-01",
            year="2026",
            month="07",
        )
        UserLocation.objects.filter(pk=old.pk).update(
            last_updated=timezone.now() - timedelta(days=20),
        )
        invalidate_cache("amniga")

        response = self.client.get(reverse("amniga-user-track-map"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["selected_user_id"])
        self.assertEqual(response.data["points"], [])
        self.assertGreaterEqual(response.data["summary"]["agents_total"], 2)
        self.assertGreaterEqual(response.data["summary"]["agents_on_duty"], 1)
        self.assertGreaterEqual(response.data["summary"]["agents_with_gps"], 2)
        self.assertGreaterEqual(len(response.data["markers"]), 2)
        markers = {m["user_code"]: m for m in response.data["markers"]}
        self.assertTrue(markers["MU2601062"]["on_duty"])
        self.assertTrue(markers["MU2601062"]["in_field"])
        self.assertEqual(markers["MU2601062"]["id_last4"], "1062")
        self.assertEqual(markers["MU2601062"]["name"], "Amina Ali")
        self.assertGreaterEqual(markers["MU2601062"]["track_count"], 1)
        self.assertGreaterEqual(markers["1063"]["track_count"], 1)
        self.assertFalse(markers["1063"]["on_duty"])
        self.assertFalse(markers["1063"]["in_field"])

        trail = self.client.get(reverse("amniga-user-track-map"), {"user_id": "MU2601062", "hours": 24})
        self.assertEqual(trail.status_code, status.HTTP_200_OK)
        self.assertEqual(trail.data["selected_user_ref"], "MU2601062")
        self.assertGreaterEqual(trail.data["summary"]["point_count"], 1)
        self.assertAlmostEqual(trail.data["points"][0]["latitude"], 2.0469, places=4)

        all_time = self.client.get(reverse("amniga-user-track-map"), {"user_id": "1063", "hours": 0})
        self.assertEqual(all_time.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(all_time.data["summary"]["point_count"], 1)

    def test_user_track_map_drops_placeholder_coords_and_keeps_real_places(self):
        from apps.accounts.models import Agent
        from apps.mobile.models import UserLocation

        agent = User.objects.create_user(
            username="MU2601999",
            email="gps_places@test.local",
            password="testpass123",
            first_name="Hodan",
            last_name="Warsame",
            is_agent=True,
            is_active=True,
            latitude="2.0469",
            longitude="45.3182",
        )
        Agent.objects.create(
            user=agent,
            service_id="AG-GPS-PLACES",
            first_name="Hodan",
            father_name="X",
            last_name="Warsame",
            fourth_name="Y",
            mother_name="Z",
            date_of_birth="1992-01-01",
            phone="612000199",
            present="Joogey",
            status="Active",
        )
        mogadishu = [
            (2.0469, 45.3182),
            (2.0478, 45.3191),
            (2.0491, 45.3210),
            (2.0504, 45.3235),
            (2.0469, 45.3182),
        ]
        now = timezone.now()
        for i, (lat, lng) in enumerate(mogadishu):
            loc = UserLocation.objects.create(
                user=agent,
                latitude=lat,
                longitude=lng,
                reg_day="2026-08-08",
                year="2026",
                month="08",
            )
            UserLocation.objects.filter(pk=loc.pk).update(
                last_updated=now + timedelta(minutes=i),
            )
        fake = UserLocation.objects.create(
            user=agent,
            latitude=6,
            longitude=48,
            reg_day="2026-08-08",
            year="2026",
            month="08",
        )
        UserLocation.objects.filter(pk=fake.pk).update(
            last_updated=now + timedelta(minutes=20),
        )
        invalidate_cache("amniga")

        trail = self.client.get(
            reverse("amniga-user-track-map"),
            {"user_id": "MU2601999", "hours": 0},
        )
        self.assertEqual(trail.status_code, status.HTTP_200_OK)
        points = trail.data["points"]
        self.assertGreaterEqual(len(points), 4)
        self.assertEqual(trail.data["summary"]["raw_point_count"], 6)
        self.assertTrue(all(p["latitude"] != 6 and p["longitude"] != 48 for p in points))
        lats = [p["latitude"] for p in points]
        lngs = [p["longitude"] for p in points]
        self.assertLess(max(lats) - min(lats), 0.02)
        self.assertLess(max(lngs) - min(lngs), 0.02)
        self.assertAlmostEqual(points[0]["latitude"], 2.0469, places=4)
        self.assertAlmostEqual(points[-1]["latitude"], 2.0469, places=4)

    def test_user_track_map_requires_agent_permission(self):
        user = User.objects.create_user(
            username="suspect_only_track",
            email="suspect_only_track@test.local",
            password="testpass123",
            is_active=True,
        )
        perm = Permission.objects.get(
            codename="view_suspect",
            content_type=ContentType.objects.get(app_label="suspects", model="suspect"),
        )
        user.user_permissions.add(perm)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(user)}")
        response = self.client.get(reverse("amniga-user-track-map"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_track_map_hides_developers_for_non_privileged_viewers(self):
        from apps.accounts.models import UserType

        dev_type, _ = UserType.objects.get_or_create(name="dev", defaults={"code": "DEV"})
        User.objects.create_user(
            username="DEVTRACK1",
            email="dev_track@test.local",
            password="testpass123",
            first_name="Dev",
            last_name="Tracker",
            is_agent=True,
            is_superuser=True,
            is_staff=True,
            user_type=dev_type,
            is_active=True,
            latitude="2.01",
            longitude="45.01",
        )
        User.objects.create_user(
            username="AGENTTRACK1",
            email="agent_track@test.local",
            password="testpass123",
            first_name="Field",
            last_name="Agent",
            is_agent=True,
            is_active=True,
            latitude="2.02",
            longitude="45.02",
        )

        officer = User.objects.create_user(
            username="officer_track_viewer",
            email="officer_track@test.local",
            password="testpass123",
            is_active=True,
        )
        officer.user_permissions.add(
            Permission.objects.get(
                codename="view_agent",
                content_type=ContentType.objects.get(app_label="accounts", model="agent"),
            )
        )
        invalidate_cache("amniga")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(officer)}")
        response = self.client.get(reverse("amniga-user-track-map"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        codes = {u["user_code"] for u in response.data["users"]}
        self.assertIn("AGENTTRACK1", codes)
        self.assertNotIn("DEVTRACK1", codes)

        # Super admin / developer viewers still see privileged agent accounts.
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(self.admin)}")
        invalidate_cache("amniga")
        admin_resp = self.client.get(reverse("amniga-user-track-map"))
        self.assertEqual(admin_resp.status_code, status.HTTP_200_OK)
        admin_codes = {u["user_code"] for u in admin_resp.data["users"]}
        self.assertIn("DEVTRACK1", admin_codes)
        self.assertIn("AGENTTRACK1", admin_codes)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(officer)}")
        invalidate_cache("amniga")
        denied = self.client.get(
            reverse("amniga-user-track-map"),
            {"user_id": "DEVTRACK1", "hours": 0},
        )
        self.assertEqual(denied.status_code, status.HTTP_200_OK)
        self.assertTrue(denied.data["selected_denied"])
        self.assertIsNone(denied.data["selected_user_id"])
        self.assertEqual(denied.data["points"], [])
        self.assertNotIn("DEVTRACK1", {u["user_code"] for u in denied.data["users"]})

        search = self.client.get(
            reverse("amniga-user-track-map"),
            {"user_id": "AGENTTRACK1", "search": "Dev Tracker", "hours": 0},
        )
        self.assertEqual(search.status_code, status.HTTP_200_OK)
        self.assertTrue(search.data["search_denied"])
        self.assertEqual(search.data["points"], [])
        self.assertIsNone(search.data["selected_user_id"])
