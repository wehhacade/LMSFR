"""Batch mobile-login probe used by the Amniga App Users page."""

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Agent, User


def _agent(user, *, nickname: str, phone: str, service_id: str) -> Agent:
    return Agent.objects.create(
        user=user,
        service_id=service_id,
        nickname=nickname,
        first_name="A",
        father_name="B",
        last_name="C",
        fourth_name="D",
        mother_name="Hooyo",
        date_of_birth="1990-01-01",
        phone=phone,
        email=user.email,
    )


class BulkMobileLoginTestAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="bulk-admin",
            email="bulk-admin@lmsbr.local",
            password="admin-pass",
        )
        self.ok_user = User.objects.create_user(
            username="ok-agent",
            email="ok-agent@lmsbr.local",
            password="0612345678",
            phone="0612345678",
            is_agent=True,
            is_mobile=True,
        )
        _agent(self.ok_user, nickname="020561563", phone="0612345678", service_id="SID-1563")

        self.secret_user = User.objects.create_user(
            username="secret-agent",
            email="secret-agent@lmsbr.local",
            password="SecretPass123!",
            phone="0619998888",
            is_agent=True,
            is_mobile=True,
        )
        _agent(self.secret_user, nickname="020562222", phone="0619998888", service_id="SID-2222")

        self.client.force_authenticate(self.admin)

    def test_bulk_returns_last4_and_phone_password(self):
        response = self.client.post(
            "/api/v3/accounts/users/test_mobile_logins/",
            {"user_ids": [self.ok_user.pk, self.secret_user.pk]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(response.data["ok"], 1)

        by_id = {row["user_id"]: row for row in response.data["results"]}
        ok_row = by_id[self.ok_user.pk]
        self.assertEqual(ok_row["last4"], "1563")
        self.assertEqual(ok_row["email"], "ok-agent@lmsbr.local")
        self.assertEqual(ok_row["password"], "0612345678")
        self.assertTrue(ok_row["last4_ok"])
        self.assertTrue(ok_row["email_ok"])
        self.assertTrue(ok_row["can_login"])
        self.assertEqual(ok_row["detail"], "OK")

        secret_row = by_id[self.secret_user.pk]
        self.assertEqual(secret_row["last4"], "2222")
        self.assertEqual(secret_row["password"], "")
        self.assertFalse(secret_row["can_login"])
        self.assertIn("phone", secret_row["detail"].lower())

    def test_empty_user_ids_rejected(self):
        response = self.client.post(
            "/api/v3/accounts/users/test_mobile_logins/",
            {"user_ids": []},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
