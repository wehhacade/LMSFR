"""Mobile login, PIN, and suspect-response legacy endpoints."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework.test import APITestCase

from apps.accounts.models import Agent
from apps.suspects.models import Suspect, SuspectResponse

User = get_user_model()


class MobileAuthTests(APITestCase):
    def setUp(self):
        self.agent = User.objects.create_user(
            username="agent1",
            email="agent1@test.com",
            password="AgentPass123!",
            is_agent=True,
        )
        Agent.objects.create(
            user=self.agent,
            service_id="MU2600522",
            # Real deployments keep the employee number here; service_id is a short code.
            nickname="270466814",
            first_name="Agent",
            father_name="Test",
            last_name="User",
            fourth_name="One",
            mother_name="Hooyo",
            date_of_birth="1990-01-01",
            phone="0610000522",
            email=self.agent.email,
        )

    def test_mobile_login_email(self):
        resp = self.client.post(
            "/api/v3/mobile/login/",
            {"username": "agent1@test.com", "password": "AgentPass123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_mobile_login_username(self):
        resp = self.client.post(
            "/api/v3/mobile/login/",
            {"username": "agent1", "password": "AgentPass123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)

    def test_mobile_login_with_last_four_of_employee_number(self):
        resp = self.client.post(
            "/api/v3/mobile/login/",
            {"username": "6814", "password": "AgentPass123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["user_id"], str(self.agent.pk))

    def test_mobile_login_last_four_ignores_internal_service_id(self):
        other = User.objects.create_user(
            username="agent-sid",
            email="agent-sid@test.com",
            password="AgentPass123!",
            is_agent=True,
        )
        Agent.objects.create(
            user=other,
            service_id="6814",
            nickname="010561515",
            first_name="Other",
            father_name="Agent",
            last_name="User",
            fourth_name="Two",
            mother_name="Hooyo",
            date_of_birth="1990-01-01",
            phone="0611111111",
            email=other.email,
        )
        resp = self.client.post(
            "/api/v3/mobile/login/",
            {"username": "6814", "password": "AgentPass123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["user_id"], str(self.agent.pk))

    def test_mobile_login_with_last_four_employee_id(self):
        resp = self.client.post(
            "/api/v3/mobile/login/",
            {"username": "6814", "password": "AgentPass123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["user_id"], str(self.agent.pk))
        self.assertIn("access", resp.data)

    def test_legacy_login_with_last_four_employee_id(self):
        resp = self.client.post(
            "/api/v3/login/",
            {"email": "6814", "password": "AgentPass123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["user_id"], str(self.agent.pk))

    def test_duplicate_last_four_fails_closed(self):
        duplicate = User.objects.create_user(
            username="agent2",
            email="agent2@test.com",
            password="AgentPass123!",
            is_agent=True,
        )
        Agent.objects.create(
            user=duplicate,
            service_id="AG990522",
            nickname="990466814",
            first_name="Agent",
            father_name="Test",
            last_name="User",
            fourth_name="Two",
            mother_name="Hooyo",
            date_of_birth="1990-01-01",
            phone="0619900522",
            email=duplicate.email,
        )
        resp = self.client.post(
            "/api/v3/mobile/login/",
            {"username": "6814", "password": "AgentPass123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_set_and_verify_pin(self):
        self.client.force_authenticate(user=self.agent)
        set_resp = self.client.post(
            "/api/v3/set-pin",
            {"user_id": str(self.agent.pk), "pin": "1234"},
            format="json",
        )
        self.assertEqual(set_resp.status_code, 200)
        self.assertFalse(set_resp.data["isError"])

        verify_resp = self.client.post(
            "/api/v3/verify-pin",
            {"user_id": str(self.agent.pk), "pin": "1234"},
            format="json",
        )
        self.assertEqual(verify_resp.status_code, 200)
        self.assertFalse(verify_resp.data["isError"])


class SuspectResponseTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="respuser",
            email="resp@test.com",
            password="Pass1234!",
            is_agent=True,
        )
        ct = ContentType.objects.get_for_model(SuspectResponse)
        for codename in ("add_suspectresponse", "view_suspectresponse"):
            perm = Permission.objects.get(content_type=ct, codename=codename)
            self.user.user_permissions.add(perm)

        self.suspect = Suspect.objects.create(
            name="Test Suspect",
            district="Hodan",
            case_ref="TST-001",
            last_seen="2026-01-01",
            offense="test",
        )
        self.client.force_authenticate(user=self.user)

    def test_create_and_list_response(self):
        create = self.client.post(
            "/api/v3/create-suspect-response",
            {
                "suspect_id": self.suspect.pk,
                "details": "Waxaan arkaa goobta",
                "user_id": str(self.user.pk),
                "ip_address": "127.0.0.1",
                "detect_os": "Android",
                "get_client_agent": "mobile",
                "model_phone": "Samsung",
            },
            format="json",
        )
        self.assertEqual(create.status_code, 200)
        self.assertFalse(create.data["isError"])

        listing = self.client.post("/api/v3/suspect-response", {"page": 1}, format="json")
        self.assertEqual(listing.status_code, 200)
        self.assertFalse(listing.data["isError"])
        self.assertEqual(len(listing.data["Message"]), 1)
