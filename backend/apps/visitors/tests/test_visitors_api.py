from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserType
from apps.visitors.models import VisitAllegation, Visitor

User = get_user_model()


class VisitorsApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.boqde_type, _ = UserType.objects.get_or_create(
            name="boqde", defaults={"code": "BQD"}
        )
        cls.agent_type, _ = UserType.objects.get_or_create(
            name="Agent", defaults={"code": "AGT"}
        )
        cls.boqde_a = User.objects.create_user(
            username="boqde-a",
            email="boqde-a@test.local",
            password="test-pass",
            user_type=cls.boqde_type,
        )
        cls.boqde_b = User.objects.create_user(
            username="boqde-b",
            email="boqde-b@test.local",
            password="test-pass",
            user_type=cls.boqde_type,
        )
        cls.agent = User.objects.create_user(
            username="agent-v",
            email="agent-v@test.local",
            password="test-pass",
            user_type=cls.agent_type,
            is_agent=True,
        )
        cls.admin = User.objects.create_superuser(
            username="vis-admin",
            email="vis-admin@test.local",
            password="test-pass",
        )

    def test_boqde_gets_visitor_permissions_on_me(self):
        """boqde user-type must receive visitors.* in /auth/me/ for the app."""
        from apps.accounts.permissions import client_permissions_for_user

        perms = client_permissions_for_user(self.boqde_a)
        self.assertIn("visitors.view_visitor", perms)
        self.assertIn("visitors.add_visitor", perms)
        self.assertIn("visitors.change_visitor", perms)
        self.assertIn("visitors.delete_visitor", perms)

    def test_boqde_can_create_and_list(self):
        self.client.force_authenticate(user=self.boqde_a)
        allegation = VisitAllegation.objects.get(name="Argagixisanimo")
        create = self.client.post(
            "/api/v3/visitors/",
            {
                "full_name": "Cali Axmed",
                "mother_name": "Xaliimo",
                "phone": "0612345678",
                "nira": "NIRA-1",
                "visiting": "Maxkamadda sare.",
                "contact_name": "Maxamed Cali Xasan",
                "relationship": "Qaraabo",
                "allegation_id": allegation.id,
                "sentence": "Xukun tijaabo ah",
                "verified": True,
            },
            format="json",
        )
        self.assertEqual(create.status_code, status.HTTP_201_CREATED, create.data)
        self.assertTrue(create.data["verified"])
        self.assertEqual(create.data["full_name"], "Cali Axmed")
        self.assertEqual(create.data["contact_name"], "Maxamed Cali Xasan")
        self.assertEqual(create.data["relationship"], "Qaraabo")
        self.assertEqual(create.data["allegation_name"], "Argagixisanimo")
        self.assertEqual(create.data["sentence"], "Xukun tijaabo ah")

        listed = self.client.get("/api/v3/visitors/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["count"], 1)

    def test_return_visit_keeps_previous_visited_at(self):
        """Re-registering the same NIRA must not rewrite older visit timestamps."""
        from apps.visitors.models import Visit
        from django.utils import timezone
        from datetime import timedelta

        self.client.force_authenticate(user=self.boqde_a)
        first_time = timezone.now() - timedelta(hours=2)
        first = self.client.post(
            "/api/v3/visitors/",
            {
                "full_name": "Return Guest",
                "nira": "NIRA-RETURN-1",
                "visiting": "Maxkamadda sare.",
                "visited_at": first_time.isoformat(),
                "verified": True,
            },
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        visitor_id = first.data["id"]
        old_visit = Visit.objects.filter(visitor_id=visitor_id).get()
        old_visited_at = old_visit.visited_at

        # Client deliberately sends the old timestamp again (the bug case).
        second = self.client.post(
            "/api/v3/visitors/",
            {
                "full_name": "Return Guest",
                "nira": "NIRA-RETURN-1",
                "visiting": "Maxkamadda G/banaadir.",
                "visited_at": old_visited_at.isoformat(),
                "verified": True,
            },
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        self.assertTrue(second.data.get("is_returning"))

        visits = list(Visit.objects.filter(visitor_id=visitor_id).order_by("id"))
        self.assertEqual(len(visits), 2)
        old_visit.refresh_from_db()
        self.assertEqual(old_visit.visited_at, old_visited_at)
        self.assertEqual(visits[0].visiting, "Maxkamadda sare.")
        self.assertEqual(visits[1].visiting, "Maxkamadda G/banaadir.")
        self.assertGreater(visits[1].visited_at, visits[0].visited_at)

    def test_no_nira_null_creates_separate_visitors(self):
        """Switch No → null/empty NIRA; each person is a new record."""
        from apps.visitors.models import Visit, Visitor

        self.client.force_authenticate(user=self.boqde_a)
        first = self.client.post(
            "/api/v3/visitors/",
            {
                "full_name": "Person A",
                "nira": None,
                "visiting": "Maxkamadda sare.",
                "verified": True,
            },
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        second = self.client.post(
            "/api/v3/visitors/",
            {
                "full_name": "Person B",
                "visiting": "Xabsiga Dhexe Ee Xamar",
                "verified": True,
            },
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        self.assertNotEqual(first.data["id"], second.data["id"])
        self.assertFalse(second.data.get("is_returning"))
        self.assertEqual(Visitor.objects.filter(id__in=[first.data["id"], second.data["id"]]).count(), 2)
        self.assertEqual(Visit.objects.filter(visitor_id=first.data["id"]).count(), 1)
        self.assertEqual(Visit.objects.filter(visitor_id=second.data["id"]).count(), 1)
        self.assertEqual(Visitor.objects.get(id=first.data["id"]).nira, "")
        self.assertEqual(Visitor.objects.get(id=second.data["id"]).nira, "")

    def test_single_zero_nira_treated_as_empty(self):
        """Old app: only exact nira='0' means no NIRA → empty, new person, no merge."""
        from apps.visitors.models import Visitor

        self.client.force_authenticate(user=self.boqde_a)
        first = self.client.post(
            "/api/v3/visitors/",
            {
                "full_name": "Old App A",
                "nira": "0",
                "visiting": "Maxkamadda sare.",
                "verified": True,
            },
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        second = self.client.post(
            "/api/v3/visitors/",
            {
                "full_name": "Old App B",
                "nira": "0",
                "visiting": "Xabsiga Dhexe Ee Xamar",
                "verified": True,
            },
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        self.assertNotEqual(first.data["id"], second.data["id"])
        self.assertFalse(second.data.get("is_returning"))
        self.assertEqual(Visitor.objects.get(id=first.data["id"]).nira, "")
        self.assertEqual(Visitor.objects.get(id=second.data["id"]).nira, "")

    def test_junk_nira_rejected(self):
        """00 / 08 / 88 rejected. Only exact '0' is the old-app empty alias."""
        self.client.force_authenticate(user=self.boqde_a)
        for bad in ("00", "08", "88"):
            resp = self.client.post(
                "/api/v3/visitors/",
                {
                    "full_name": f"Bad {bad}",
                    "nira": bad,
                    "visiting": "Maxkamadda sare.",
                    "verified": True,
                },
                format="json",
            )
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.data)
            self.assertIn("nira", resp.data)

    def test_same_real_nira_is_unique_returning_visitor(self):
        """Same matchable NIRA must not create a second visitor row."""
        from apps.visitors.models import Visit, Visitor

        self.client.force_authenticate(user=self.boqde_a)
        first = self.client.post(
            "/api/v3/visitors/",
            {
                "full_name": "Unique Person",
                "nira": "9988776655",
                "visiting": "Maxkamadda sare.",
                "verified": True,
            },
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        second = self.client.post(
            "/api/v3/visitors/",
            {
                "full_name": "Unique Person Again",
                "nira": "9988776655",
                "visiting": "Xabsiga Dhexe Ee Xamar",
                "verified": True,
            },
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertTrue(second.data.get("is_returning"))
        self.assertEqual(Visitor.objects.filter(nira__iexact="9988776655", is_hidden=False).count(), 1)
        self.assertEqual(Visit.objects.filter(visitor_id=first.data["id"]).count(), 2)

    def test_cleanup_moves_false_returns_to_hidden_sink(self):
        from django.utils import timezone
        from datetime import timedelta

        from apps.visitors.models import Visit, Visitor
        from apps.visitors.services.cleanup import HIDDEN_SINK_NAME, cleanup_bloated_placeholder_profiles

        visitor = Visitor.objects.create(
            full_name="Bloated Person",
            nira="08",
            created_by=self.boqde_a,
            visited_at=timezone.now(),
            verified=True,
        )
        older = timezone.now() - timedelta(days=3)
        mid = timezone.now() - timedelta(days=1)
        latest = timezone.now()
        Visit.objects.create(visitor=visitor, visiting="Maxkamadda sare.", visited_at=older)
        Visit.objects.create(visitor=visitor, visiting="Maxkamadda sare.", visited_at=mid)
        Visit.objects.create(visitor=visitor, visiting="Xabsiga Dhexe Ee Xamar", visited_at=latest)
        visitor.visited_at = latest
        visitor.save(update_fields=["visited_at"])

        result = cleanup_bloated_placeholder_profiles(dry_run=False)
        self.assertEqual(result["profiles_cleaned"], 1)
        self.assertEqual(result["visits_moved"], 2)

        visitor.refresh_from_db()
        self.assertEqual(visitor.nira, "08")
        self.assertEqual(Visit.objects.filter(visitor_id=visitor.id).count(), 1)
        self.assertEqual(
            Visit.objects.get(visitor_id=visitor.id).visiting,
            "Xabsiga Dhexe Ee Xamar",
        )

        sink = Visitor.objects.get(is_hidden=True, full_name=HIDDEN_SINK_NAME)
        self.assertEqual(Visit.objects.filter(visitor_id=sink.id).count(), 2)

        self.client.force_authenticate(user=self.boqde_a)
        listed = self.client.get("/api/v3/visitors/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        names = [row["full_name"] for row in listed.data["results"]]
        self.assertIn("Bloated Person", names)
        self.assertNotIn(HIDDEN_SINK_NAME, names)

    def test_boqde_sees_other_boqde_records(self):
        Visitor.objects.create(
            full_name="Shared Guest",
            created_by=self.boqde_a,
            verified=False,
        )
        self.client.force_authenticate(user=self.boqde_b)
        response = self.client.get("/api/v3/visitors/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["full_name"], "Shared Guest")

    def test_agent_denied(self):
        self.client.force_authenticate(user=self.agent)
        response = self.client.get("/api/v3/visitors/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_sees_all(self):
        Visitor.objects.create(full_name="Admin View", created_by=self.boqde_a)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v3/visitors/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 1)

    def test_stats_and_analytics(self):
        Visitor.objects.create(
            full_name="Dash Guest",
            created_by=self.boqde_a,
            verified=True,
            phone="0611111111",
        )
        self.client.force_authenticate(user=self.boqde_a)
        stats = self.client.get("/api/v3/visitors/stats/")
        self.assertEqual(stats.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(stats.data["total"], 1)
        self.assertIn("verified", stats.data)

        analytics = self.client.get("/api/v3/visitors/analytics/")
        self.assertEqual(analytics.status_code, status.HTTP_200_OK)
        self.assertEqual(len(analytics.data["weekly_trend"]), 7)
        self.assertTrue(len(analytics.data["status_breakdown"]) >= 1)
        self.assertIn("top_visitors", analytics.data)
        self.assertIn("top_destinations", analytics.data)

        daily = self.client.get("/api/v3/visitors/analytics/", {"range": "1d", "date": "2026-09-26"})
        self.assertEqual(daily.status_code, status.HTTP_200_OK)
        self.assertEqual(len(daily.data["weekly_trend"]), 1)

    def test_destinations_list_and_rejects_free_text(self):
        self.client.force_authenticate(user=self.boqde_a)
        listed = self.client.get("/api/v3/visitors/destinations/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        names = [row["name"] for row in listed.data]
        self.assertEqual(names[0], "Maxkamadda Ciidanka QS.")
        self.assertIn("Xeer ilaalinta Guud Qaranka.", names)
        self.assertIn("Xabsiga Dhexe Ee Xamar", names)
        self.assertEqual(len(names), 6)

        allegations = self.client.get("/api/v3/visitors/allegations/")
        self.assertEqual(allegations.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["name"] for row in allegations.data],
            ["Argagixisanimo", "Dhac hubaysan", "Dil"],
        )

        rejected = self.client.post(
            "/api/v3/visitors/",
            {"full_name": "Cali", "visiting": "Xafiiska"},
            format="json",
        )
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
