"""Relationship model and accounts API tests."""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Relationship
from apps.suspects.tests.base import DEFAULT_RELATIONSHIPS, create_admin_user, seed_relationships


class RelationshipModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed_relationships()

    def test_str_uses_relationship_field(self):
        rel = Relationship.objects.get(pk=1)
        self.assertEqual(str(rel), "Walaal")

    def test_all_ten_rows_exist(self):
        self.assertEqual(Relationship.objects.count(), len(DEFAULT_RELATIONSHIPS))


class RelationshipAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed_relationships()
        cls.user = create_admin_user(email="rel-api@lmsbr.local")

    def setUp(self):
        self.client.force_authenticate(user=self.user)

    def test_accounts_relationships_list(self):
        response = self.client.get("/api/v3/accounts/relationships/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertGreaterEqual(len(results), 10)
        first = results[0]
        self.assertIn("relationship", first)
        self.assertIn("name", first)
        self.assertEqual(first["relationship"], first["name"])
