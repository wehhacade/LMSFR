"""Shared fixtures for suspect domain tests."""

from __future__ import annotations

from datetime import date

from django.contrib.auth import get_user_model

from apps.accounts.models import County, Region, Relationship, SubCounty
from apps.suspects.models import Suspect, SuspectStatus

User = get_user_model()

DEFAULT_RELATIONSHIPS = (
    (1, "Walaal"),
    (2, "Hooyo"),
    (3, "Aabo"),
    (4, "Adeer"),
    (5, "Abti"),
    (6, "Edo"),
    (7, "Habo"),
    (8, "Masuul (Aqoonsi wata)"),
    (9, "Lamaane"),
    (10, "Caruur"),
)


def seed_relationships() -> None:
    for pk, label in DEFAULT_RELATIONSHIPS:
        Relationship.objects.update_or_create(id=pk, defaults={"relationship": label})


def create_admin_user(*, email: str = "suspect-test@lmsbr.local") -> User:
    return User.objects.create_user(
        username="suspect_tester",
        email=email,
        password="testpass12345",
        is_admin=True,
        is_active=True,
    )


def create_location_fixtures() -> dict:
    region = Region.objects.create(pk=1, name="Banaadir", code="BN")
    county = County.objects.create(pk=6, name="Hodan", code="HD", region=region)
    sub_county = SubCounty.objects.create(pk=55, name="Kacaan", code="KC", county=county)
    return {"region": region, "county": county, "sub_county": sub_county}


def create_suspect_status(name: str = "Shaki") -> SuspectStatus:
    status, _ = SuspectStatus.objects.get_or_create(name=name)
    return status


def create_suspect(*, county, sub_county, status, user, name: str = "Test Suspect") -> Suspect:
    return Suspect.objects.create(
        name=name,
        district="Hodan",
        case_ref=f"TST-{Suspect.objects.count() + 1:04d}",
        last_seen=date.today(),
        offense="—",
        suspect_type=status,
        capture_county=county,
        capture_sub_county=sub_county,
        created_by=user,
    )
