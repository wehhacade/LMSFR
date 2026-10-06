"""User update API — editable email and username."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserUpdateEmailTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_edit",
            email="admin_edit@test.local",
            password="testpass123",
            is_admin=True,
            is_active=True,
        )
        self.target = User.objects.create_user(
            username="MU2500184",
            email="Xabiibxamza319gmail.com",
            password="testpass123",
            is_active=True,
            is_agent=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(self.admin).access_token}")

    def test_patch_user_email_and_username(self):
        url = reverse("account-user-detail", kwargs={"pk": self.target.pk})
        res = self.client.patch(
            url,
            {"email": "xabiib@nisa.gov.so", "username": "MU2500184"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertEqual(self.target.email, "xabiib@nisa.gov.so")

    def test_patch_rejects_duplicate_email(self):
        User.objects.create_user(
            username="other_user",
            email="taken@test.local",
            password="testpass123",
            is_active=True,
        )
        url = reverse("account-user-detail", kwargs={"pk": self.target.pk})
        res = self.client.patch(url, {"email": "taken@test.local"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
