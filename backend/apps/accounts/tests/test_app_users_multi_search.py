"""App Users search: many EMP / last-4 IDs in one query."""

from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Agent, User
from apps.accounts.services.staff_search import parse_app_users_search_terms


def _agent(user, *, nickname: str, phone: str, service_id: str, first_name="A") -> Agent:
    return Agent.objects.create(
        user=user,
        service_id=service_id,
        nickname=nickname,
        first_name=first_name,
        father_name="B",
        last_name="C",
        fourth_name="D",
        mother_name="Hooyo",
        date_of_birth="1990-01-01",
        phone=phone,
        email=user.email,
    )


class ParseAppUsersSearchTests(SimpleTestCase):
    def test_name_with_space_stays_one_term(self):
        self.assertEqual(parse_app_users_search_terms("Cali Xasan"), ["Cali Xasan"])

    def test_space_separated_numeric_ids(self):
        self.assertEqual(
            parse_app_users_search_terms("20561563 230967875 200268645"),
            ["20561563", "230967875", "200268645"],
        )

    def test_comma_and_newlines(self):
        self.assertEqual(
            parse_app_users_search_terms("1563, 2222\n6814"),
            ["1563", "2222", "6814"],
        )


class AppUsersMultiSearchAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="search-admin",
            email="search-admin@lmsbr.local",
            password="admin-pass",
        )
        self.one = User.objects.create_user(
            username="search-one",
            email="search-one@lmsbr.local",
            password="pass",
            is_agent=True,
            first_name="Cali",
        )
        _agent(self.one, nickname="020561563", phone="0612000001", service_id="SID-9999", first_name="Cali")
        self.two = User.objects.create_user(
            username="search-two",
            email="search-two@lmsbr.local",
            password="pass",
            is_agent=True,
        )
        _agent(self.two, nickname="020562222", phone="0612000002", service_id="1563")
        self.client.force_authenticate(self.admin)

    def _ids(self, search: str) -> set[int]:
        response = self.client.get(
            "/api/v3/accounts/agents/app-users/",
            {"search": search, "page_size": 100},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {row["user_id"] for row in response.data["results"] if row.get("user_id")}

    def test_space_separated_employee_numbers(self):
        found = self._ids("20561563 20562222")
        self.assertEqual(found, {self.one.pk, self.two.pk})

    def test_comma_separated_last_four(self):
        found = self._ids("1563, 2222")
        self.assertEqual(found, {self.one.pk, self.two.pk})

    def test_last_four_ignores_service_id(self):
        found = self._ids("1563")
        self.assertEqual(found, {self.one.pk})
        self.assertNotIn(self.two.pk, found)

    def test_name_with_space_does_not_split(self):
        found = self._ids("Cali XYZNOMATCH")
        self.assertEqual(found, set())
