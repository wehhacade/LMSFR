"""Baaris registry must not disturb amniga suspect rows."""

from django.test import TestCase

from apps.accounts.models import User, UserType
from apps.baaris.register_service import register_baaris_citizen
from apps.suspects.models import Suspect


class BaarisSourceSafetyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="baaris_agent", password="x")
        self.user.is_agent = True
        self.user.is_mobile = True
        self.user.save(update_fields=["is_agent", "is_mobile"])

    def test_existing_suspects_default_amniga(self):
        s = Suspect.objects.create(
            name="Legacy Person",
            mother_name="Hooyo",
            district="Hodan",
            case_ref="LEG-1",
            last_seen="2026-01-01",
            offense="test",
            created_by=self.user,
        )
        s.refresh_from_db()
        self.assertEqual(s.source, Suspect.Source.AMNIGA)

    def test_baaris_register_sets_source_and_profile(self):
        result = register_baaris_citizen(
            {
                "name": "Cali Axmed",
                "mother": "Maryan",
                "hormuud": "0612345678",
                "address_county_obj": None,
                "district": "Hodan",
            },
            self.user,
        )
        self.assertEqual(result.suspect.source, Suspect.Source.BAARIS)
        self.assertTrue(hasattr(result.suspect, "baaris_profile"))
        self.assertEqual(result.profile.hormuud, "0612345678")

    def test_user_type_label(self):
        from apps.mobile.helpers import user_permission_label

        ut, _ = UserType.objects.get_or_create(name="baaris", defaults={"code": "BAR"})
        self.user.user_type = ut
        self.user.save(update_fields=["user_type"])
        self.assertEqual(user_permission_label(self.user), "Baaris")
