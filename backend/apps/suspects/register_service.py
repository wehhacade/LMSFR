"""One-shot suspect + case + damiin registration (fast path)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.suspects.models import Suspect, SuspectCase, SuspectStatus
from apps.suspects.photo_utils import schedule_photo_updates
from apps.suspects.services import DamiinCreateInput, create_damiin_and_case

logger = logging.getLogger(__name__)


@dataclass
class RegisterCompleteResult:
    suspect: Suspect
    case: SuspectCase
    damiin_id: int


def _build_damiin_input(validated: dict[str, Any], *, suspect_id: int) -> DamiinCreateInput:
    doorasho = validated["doorasho"]
    common = dict(
        suspect_id=suspect_id,
        doorasho=doorasho,
        case_description=validated["faahfaahin"],
        suspect_type_id=validated["suspect_type_obj"].pk,
        capture_county_id=str(validated["capture_county_obj"].pk),
        capture_sub_county_id=str(validated["capture_sub_county_obj"].pk),
    )
    if doorasho == "no_damiin":
        return DamiinCreateInput(**common)

    if doorasho == "dhamaan_damiin" or doorasho == "isla_damiin":
        return DamiinCreateInput(**common, damiin_id=validated.get("damiin_id"))

    return DamiinCreateInput(
        **common,
        damiin_id=validated.get("damiin_id"),
        names=validated["damiin_name"],
        phone=validated["damiin_phone"],
        gender=validated["damiin_gender"],
        relationship=validated.get("relationship"),
        description="—",
        damiin_county_id=str(validated["damiin_county_obj"].pk),
    )


@transaction.atomic
def register_suspect_complete(validated: dict[str, Any], user) -> RegisterCompleteResult:
    today = timezone.now().date()
    address_county = validated["address_county_obj"]
    capture_county = validated["capture_county_obj"]
    capture_sub = validated["capture_sub_county_obj"]
    suspect_type: SuspectStatus = validated["suspect_type_obj"]

    suspect = Suspect.objects.create(
        name=validated["fullname"],
        mother_name=validated["mother"],
        gender=validated["gender"],
        phone=validated["phone"],
        occupation=validated["occupation"],
        lambarka_diiwaanka=validated["identity_card"],
        address=address_county,
        suspect_type=suspect_type,
        capture_county=capture_county,
        capture_sub_county=capture_sub,
        notes=validated["faahfaahin"],
        offense="—",
        district=capture_county.name,
        case_ref=f"REG-{timezone.now().strftime('%Y%m%d%H%M%S%f')}",
        last_seen=today,
        date_opp=today,
        day=f"{today.day:02d}",
        month=f"{today.month:02d}",
        year=str(today.year),
        created_by=user,
        source=Suspect.Source.AMNIGA,
    )

    damiin_input = _build_damiin_input(validated, suspect_id=suspect.pk)
    case = create_damiin_and_case(damiin_input, user)

    photo_jobs: list[tuple[str, int, str, object]] = []
    if validated.get("picture"):
        photo_jobs.append(("suspect", suspect.pk, "photo_url", validated["picture"]))
    if case.damiin_id:
        if validated.get("damiin_picture"):
            photo_jobs.append(("damiin", case.damiin_id, "picture_url", validated["damiin_picture"]))
        if validated.get("damiin_identity_picture"):
            photo_jobs.append(
                ("damiin", case.damiin_id, "identity_picture_url", validated["damiin_identity_picture"])
            )

    schedule_photo_updates(photo_jobs)

    # FCM / response hooks after commit — never block or roll back registration.
    suspect_id = suspect.pk
    user_id = user.pk

    def _run_hooks() -> None:
        from django.contrib.auth import get_user_model

        from apps.suspects.response_hooks import after_suspect_registered

        User = get_user_model()
        try:
            s = Suspect.objects.get(pk=suspect_id)
            u = User.objects.get(pk=user_id)
            after_suspect_registered(s, u)
        except Exception:
            logger.exception(
                "after_suspect_registered failed suspect_id=%s user_id=%s",
                suspect_id,
                user_id,
            )

    transaction.on_commit(_run_hooks)

    return RegisterCompleteResult(suspect=suspect, case=case, damiin_id=case.damiin_id or 0)
