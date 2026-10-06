"""Unit tests for damiin/case services and relationship resolution."""

from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.suspects.models import Damiinada, SuspectCase
from apps.suspects.services import DamiinCreateInput, _resolve_relationship, create_damiin_and_case

from .base import (
    create_admin_user,
    create_location_fixtures,
    create_suspect,
    create_suspect_status,
    seed_relationships,
)


class ResolveRelationshipTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed_relationships()

    def test_by_legacy_id(self):
        rel, label = _resolve_relationship(1)
        self.assertEqual(rel.pk, 1)
        self.assertEqual(label, "Walaal")

    def test_by_name(self):
        rel, label = _resolve_relationship("Hooyo")
        self.assertEqual(rel.pk, 2)
        self.assertEqual(label, "Hooyo")

    def test_unknown_id_raises(self):
        with self.assertRaises(ValidationError):
            _resolve_relationship(99)


class CreateDamiinAndCaseTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed_relationships()
        cls.user = create_admin_user()
        loc = create_location_fixtures()
        cls.region = loc["region"]
        cls.county = loc["county"]
        cls.sub_county = loc["sub_county"]
        cls.status = create_suspect_status()

    def setUp(self):
        self.suspect = create_suspect(
            county=self.county,
            sub_county=self.sub_county,
            status=self.status,
            user=self.user,
            name="Service Test Suspect",
        )

    def test_first_case_saves_county_sub_county_and_relationship(self):
        payload = DamiinCreateInput(
            suspect_id=self.suspect.pk,
            names="Damiin Service",
            phone="611000001",
            relationship=1,
            damiin_county_id=str(self.county.pk),
            damiin_sub_county_id=str(self.sub_county.pk),
            description="Faahfaahin",
        )
        case = create_damiin_and_case(payload, self.user)

        damiin = Damiinada.objects.get(pk=case.damiin_id)
        self.assertEqual(damiin.name, "Damiin Service")
        self.assertEqual(damiin.county_id, self.county.pk)
        self.assertEqual(damiin.sub_county_id, self.sub_county.pk)
        self.assertEqual(damiin.new_relationship_id, 1)
        self.assertEqual(damiin.relationship, "Walaal")

        self.assertEqual(case.capture_county_id, self.county.pk)
        self.assertEqual(case.capture_sub_county_id, self.sub_county.pk)
        self.assertEqual(case.tuhunka_id, self.status.pk)
        self.assertTrue(case.case_code.startswith("SC"))

    def test_missing_relationship_raises(self):
        payload = DamiinCreateInput(
            suspect_id=self.suspect.pk,
            names="No Rel",
            phone="611000002",
            damiin_county_id=str(self.county.pk),
        )
        with self.assertRaises(ValidationError) as ctx:
            create_damiin_and_case(payload, self.user)
        self.assertIn("relationship", ctx.exception.detail)

    def test_missing_county_raises(self):
        bare = create_suspect(
            county=None,
            sub_county=None,
            status=self.status,
            user=self.user,
            name="No County Suspect",
        )
        payload = DamiinCreateInput(
            suspect_id=bare.pk,
            names="No County Damiin",
            phone="611000003",
            relationship="Aabo",
        )
        with self.assertRaises(ValidationError) as ctx:
            create_damiin_and_case(payload, self.user)
        self.assertIn("degmada_laga_qabtay", ctx.exception.detail)

    def test_sub_county_must_belong_to_county(self):
        other_county = type(self.county).objects.create(pk=7, name="Waaberi", code="WB", region=self.region)
        payload = DamiinCreateInput(
            suspect_id=self.suspect.pk,
            names="Bad Sub",
            phone="611000004",
            relationship=3,
            damiin_county_id=str(other_county.pk),
            damiin_sub_county_id=str(self.sub_county.pk),
        )
        with self.assertRaises(ValidationError) as ctx:
            create_damiin_and_case(payload, self.user)
        self.assertIn("sub_county", ctx.exception.detail)

    def test_duplicate_phone_rejected(self):
        first = DamiinCreateInput(
            suspect_id=self.suspect.pk,
            names="First",
            phone="611000005",
            relationship=1,
            damiin_county_id=str(self.county.pk),
        )
        create_damiin_and_case(first, self.user)

        other = create_suspect(
            county=self.county,
            sub_county=self.sub_county,
            status=self.status,
            user=self.user,
            name="Other Suspect",
        )
        second = DamiinCreateInput(
            suspect_id=other.pk,
            names="Duplicate Phone",
            phone="611000005",
            relationship=2,
            damiin_county_id=str(self.county.pk),
        )
        with self.assertRaises(ValidationError) as ctx:
            create_damiin_and_case(second, self.user)
        self.assertIn("phone", ctx.exception.detail)

    def test_creates_case_row(self):
        payload = DamiinCreateInput(
            suspect_id=self.suspect.pk,
            names="Case Row",
            phone="611000006",
            relationship="Lamaane",
            damiin_county_id=str(self.county.pk),
        )
        before = SuspectCase.objects.count()
        create_damiin_and_case(payload, self.user)
        self.assertEqual(SuspectCase.objects.count(), before + 1)
