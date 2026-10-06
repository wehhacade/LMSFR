"""Business logic for damiin + suspect case creation (old create_Damiinada_v2 flow)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import County, Relationship, SubCounty

from .codes import generate_case_code, generate_damiin_code
from .models import Damiinada, Suspect, SuspectCase, SuspectStatus, capture_count_for_suspect
from .photo_utils import schedule_photo_updates


@dataclass
class DamiinCreateInput:
    suspect_id: int
    doorasho: str = "new_damiin"
    damiin_id: int | None = None
    names: str = ""
    phone: str = ""
    gender: str = ""
    relationship: Any = None
    occupation: str = ""
    workplace: str = ""
    description: str = ""
    damiin_county_id: str | None = None
    damiin_sub_county_id: str | None = None
    capture_county_id: str | None = None
    capture_sub_county_id: str | None = None
    suspect_type_id: int | None = None
    case_description: str = ""
    damiin_picture: object | None = None
    damiin_identity_picture: object | None = None


def _resolve_county(county_id: str | None) -> County | None:
    if county_id in (None, "", 0, "0"):
        return None
    try:
        return County.objects.only("id", "name").get(pk=county_id)
    except (County.DoesNotExist, ValueError, TypeError) as exc:
        raise ValidationError({"county": "Degmo sax ah dooro."}) from exc


def _resolve_sub_county(sub_county_id: str | None, *, county: County | None = None) -> SubCounty | None:
    if sub_county_id in (None, "", 0, "0"):
        return None
    try:
        sub = SubCounty.objects.select_related("county").only("id", "name", "county_id").get(pk=sub_county_id)
    except (SubCounty.DoesNotExist, ValueError, TypeError) as exc:
        raise ValidationError({"sub_county": "Waax sax ah dooro."}) from exc
    if county and sub.county_id != county.id:
        raise ValidationError({"sub_county": "Waaxdu kuma habboona degmada la doortay."})
    return sub


def _resolve_status(status_id: int | None, fallback: SuspectStatus | None = None) -> SuspectStatus | None:
    if status_id:
        try:
            return SuspectStatus.objects.get(pk=status_id)
        except SuspectStatus.DoesNotExist as exc:
            raise ValidationError({"suspect_type": "Nooca tuhunka lama helin."}) from exc
    return fallback


def _resolve_relationship(raw: Any) -> tuple[Relationship | None, str]:
    if raw in (None, "", 0, "0"):
        return None, ""
    text = str(raw).strip()
    if text.isdigit():
        try:
            rel = Relationship.objects.only("id", "relationship").get(pk=int(text))
            return rel, rel.relationship
        except Relationship.DoesNotExist as exc:
            raise ValidationError({"relationship": "Xiriirka lama helin."}) from exc
    rel = Relationship.objects.filter(relationship__iexact=text).only("id", "relationship").first()
    return rel, rel.relationship if rel else text


def _duplicate_case_exists(*, suspect_id: int, damiin_id: int, tuhunka_id: int | None) -> bool:
    qs = SuspectCase.objects.filter(suspect_id=suspect_id, damiin_id=damiin_id)
    if tuhunka_id:
        qs = qs.filter(tuhunka_id=tuhunka_id)
    return qs.exists()


def _create_damiin(data: DamiinCreateInput, user, *, suspect: Suspect) -> Damiinada:
    if not data.names.strip():
        raise ValidationError({"names": "Fadlan qor magaca Damiinada."})
    if not data.phone.strip():
        raise ValidationError({"phone": "Fadlan qor lambarka telefoonka."})
    if Damiinada.objects.filter(phone=data.phone).exists():
        existing = Damiinada.objects.select_related("county").filter(phone=data.phone).order_by("-id").first()
        county_name = existing.county.name if existing and existing.county else "Unknown"
        raise ValidationError(
            {"phone": f"Damiinada waxaa horay loogu diiwaan geliyey ({existing.name}) oo degan ({county_name})."}
        )

    county = _resolve_county(data.damiin_county_id) or suspect.capture_county
    if not county:
        raise ValidationError({"degmada_laga_qabtay": "Fadlan dooro degmada Damiinada."})

    sub_county = _resolve_sub_county(data.damiin_sub_county_id, county=county) or (
        suspect.capture_sub_county if suspect.capture_sub_county and suspect.capture_sub_county.county_id == county.id else None
    )

    rel_fk, rel_name = _resolve_relationship(data.relationship)
    if not rel_name:
        raise ValidationError({"relationship": "Fadlan qor xiriirka."})

    damiin = Damiinada(
        code=generate_damiin_code(),
        name=data.names.strip(),
        gender=(data.gender or "").strip(),
        phone=data.phone.strip(),
        new_relationship=rel_fk,
        relationship=rel_name,
        occupation=data.occupation.strip(),
        workplace=data.workplace.strip(),
        description=data.description.strip(),
        county=county,
        sub_county=sub_county,
        created_by=user,
    )
    damiin.save()
    photo_jobs = []
    if data.damiin_picture:
        photo_jobs.append(("damiin", damiin.pk, "picture_url", data.damiin_picture))
    if data.damiin_identity_picture:
        photo_jobs.append(
            ("damiin", damiin.pk, "identity_picture_url", data.damiin_identity_picture)
        )
    schedule_photo_updates(photo_jobs)
    return damiin


def _create_case(
    *,
    suspect: Suspect,
    damiin: Damiinada | None,
    tuhunka: SuspectStatus | None,
    capture_county: County | None,
    capture_sub_county: SubCounty | None,
    description: str,
    user,
) -> SuspectCase:
    if damiin and _duplicate_case_exists(
        suspect_id=suspect.pk,
        damiin_id=damiin.pk,
        tuhunka_id=tuhunka.pk if tuhunka else None,
    ):
        label = tuhunka.name if tuhunka else "—"
        raise ValidationError({"case": f"Casekani horuu u jira oo tuhunku yahay {label}."})

    if capture_sub_county and capture_county and capture_sub_county.county_id != capture_county.id:
        raise ValidationError({"sub_county": "Waaxda qabashada kuma habboona degmada qabashada."})

    case = SuspectCase(
        case_code=generate_case_code(),
        suspect=suspect,
        damiin=damiin,
        tuhunka=tuhunka,
        capture_county=capture_county,
        capture_sub_county=capture_sub_county,
        description=description or suspect.notes or suspect.offense or "",
        created_by=user,
    )
    case.save()
    Suspect.objects.filter(pk=case.suspect_id).update(
        bail_count=capture_count_for_suspect(case.suspect_id),
        updated_at=timezone.now(),
    )
    return case


def _sync_suspect_from_case(
    suspect: Suspect,
    *,
    tuhunka,
    capture_county: County | None,
    capture_sub_county: SubCounty | None,
    description: str,
):
    updates: dict[str, Any] = {"updated_at": timezone.now()}
    if tuhunka:
        updates["suspect_type_id"] = tuhunka.pk
    if capture_county:
        updates["capture_county_id"] = capture_county.pk
    if capture_sub_county:
        updates["capture_sub_county_id"] = capture_sub_county.pk
    if description:
        updates["notes"] = description
    Suspect.objects.filter(pk=suspect.pk).update(**updates)


@transaction.atomic
def create_damiin_and_case(data: DamiinCreateInput, user) -> SuspectCase:
    try:
        suspect = Suspect.objects.select_related(
            "suspect_type",
            "capture_county",
            "capture_sub_county",
            "capture_sub_county__county",
        ).get(pk=data.suspect_id)
    except Suspect.DoesNotExist as exc:
        raise ValidationError({"suspect_id": "Tuhunsanaha lama helin."}) from exc

    has_cases = SuspectCase.objects.filter(suspect_id=suspect.pk).exists()
    doorasho = (data.doorasho or "new_damiin").lower()

    if not has_cases:
        if doorasho == "no_damiin":
            tuhunka = suspect.suspect_type
            case = _create_case(
                suspect=suspect,
                damiin=None,
                tuhunka=tuhunka,
                capture_county=suspect.capture_county,
                capture_sub_county=suspect.capture_sub_county,
                description=suspect.notes or suspect.offense or data.case_description,
                user=user,
            )
            _sync_suspect_from_case(
                suspect,
                tuhunka=tuhunka,
                capture_county=suspect.capture_county,
                capture_sub_county=suspect.capture_sub_county,
                description=suspect.notes or suspect.offense or data.case_description,
            )
            return case

        if doorasho in ("dhamaan_damiin", "isla_damiin"):
            if not data.damiin_id:
                raise ValidationError({"damiin_id": "Fadlan dooro Damiinada."})
            try:
                damiin = Damiinada.objects.select_related("county", "sub_county").get(pk=data.damiin_id)
            except Damiinada.DoesNotExist as exc:
                raise ValidationError({"damiin_id": "Damiinada lama helin."}) from exc
        else:
            damiin = _create_damiin(data, user, suspect=suspect)

        tuhunka = suspect.suspect_type
        case = _create_case(
            suspect=suspect,
            damiin=damiin,
            tuhunka=tuhunka,
            capture_county=suspect.capture_county,
            capture_sub_county=suspect.capture_sub_county,
            description=suspect.notes or suspect.offense or data.case_description,
            user=user,
        )
        _sync_suspect_from_case(
            suspect,
            tuhunka=tuhunka,
            capture_county=suspect.capture_county,
            capture_sub_county=suspect.capture_sub_county,
            description=suspect.notes or suspect.offense or data.case_description,
        )
        return case

    if doorasho in ("isla_damiin", "dhamaan_damiin"):
        if not data.damiin_id:
            raise ValidationError({"damiin_id": "Fadlan dooro Damiinada."})
        try:
            damiin = Damiinada.objects.get(pk=data.damiin_id)
        except Damiinada.DoesNotExist as exc:
            raise ValidationError({"damiin_id": "Damiinada lama helin."}) from exc

        capture_county = _resolve_county(data.capture_county_id)
        if not capture_county:
            raise ValidationError({"degmada_qabashada": "Fadlan dooro degmada."})
        capture_sub_county = _resolve_sub_county(data.capture_sub_county_id, county=capture_county)
        if not capture_sub_county:
            raise ValidationError({"sub_county": "Fadlan dooro waaxda."})
        tuhunka = _resolve_status(data.suspect_type_id)
        if not tuhunka:
            raise ValidationError({"reason": "Fadlan dooro tuhunka."})
        if not data.case_description.strip():
            raise ValidationError({"faahfaahin": "Fadlan qor faahfaahinta."})

        case = _create_case(
            suspect=suspect,
            damiin=damiin,
            tuhunka=tuhunka,
            capture_county=capture_county,
            capture_sub_county=capture_sub_county,
            description=data.case_description,
            user=user,
        )
        _sync_suspect_from_case(
            suspect,
            tuhunka=tuhunka,
            capture_county=capture_county,
            capture_sub_county=capture_sub_county,
            description=data.case_description,
        )
        return case

    damiin = _create_damiin(data, user, suspect=suspect)
    capture_county = _resolve_county(data.capture_county_id) or suspect.capture_county
    capture_sub_county = _resolve_sub_county(data.capture_sub_county_id, county=capture_county) or suspect.capture_sub_county
    tuhunka = _resolve_status(data.suspect_type_id, suspect.suspect_type)
    if not tuhunka:
        raise ValidationError({"reason": "Fadlan dooro tuhunka."})
    if not data.case_description.strip():
        raise ValidationError({"faahfaahin": "Fadlan qor faahfaahinta."})

    case = _create_case(
        suspect=suspect,
        damiin=damiin,
        tuhunka=tuhunka,
        capture_county=capture_county,
        capture_sub_county=capture_sub_county,
        description=data.case_description,
        user=user,
    )
    _sync_suspect_from_case(
        suspect,
        tuhunka=tuhunka,
        capture_county=capture_county,
        capture_sub_county=capture_sub_county,
        description=data.case_description,
    )
    return case


def parse_damiin_payload(raw: dict[str, Any], *, suspect_id: int | None = None) -> DamiinCreateInput:
    sid = raw.get("suspect_id") or raw.get("suspect") or suspect_id
    return DamiinCreateInput(
        suspect_id=int(sid),
        doorasho=str(raw.get("doorasho") or raw.get("selection") or "new_damiin"),
        damiin_id=int(raw["damiin_id"]) if raw.get("damiin_id") not in (None, "", "Unknown", "unknown") else None,
        names=str(raw.get("names") or raw.get("name") or raw.get("full_name") or raw.get("damiin_name") or ""),
        phone=str(raw.get("phone") or raw.get("damiin_phone") or ""),
        gender=str(raw.get("gender") or raw.get("damiin_gender") or ""),
        relationship=raw.get("relationship"),
        occupation=str(raw.get("occupation") or ""),
        workplace=str(raw.get("goobta_shaqada") or raw.get("workplace") or ""),
        description=str(raw.get("description") or raw.get("notes") or ""),
        damiin_county_id=raw.get("degmada_laga_qabtay") or raw.get("damiin_county_id") or raw.get("damiin_county") or raw.get("county_id"),
        damiin_sub_county_id=raw.get("damiin_sub_county") or raw.get("damiin_sub_county_id"),
        capture_county_id=raw.get("degmada_qabashada") or raw.get("capture_county_id") or raw.get("county"),
        capture_sub_county_id=raw.get("sub_county") or raw.get("capture_sub_county_id"),
        suspect_type_id=int(raw["reason"]) if raw.get("reason") not in (None, "") else (
            int(raw["suspect_type"]) if raw.get("suspect_type") not in (None, "") else None
        ),
        case_description=str(raw.get("faahfaahin") or raw.get("case_description") or raw.get("descriptionTuhun") or ""),
        damiin_picture=raw.get("damiin_picture"),
        damiin_identity_picture=raw.get("damiin_identity_picture"),
    )
