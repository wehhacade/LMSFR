"""Register citizen ID (baaris) onto shared Suspect identity + profile."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.baaris.models import BaarisCitizenProfile
from apps.suspects.face_service import normalize_phone
from apps.suspects.models import Suspect
from apps.suspects.photo_utils import schedule_photo_updates


@dataclass
class BaarisRegisterResult:
    suspect: Suspect
    profile: BaarisCitizenProfile


def _primary_phone(validated: dict[str, Any]) -> str:
    for key in ("hormuud", "phone", "somnet", "somtel"):
        raw = validated.get(key) or ""
        digits = normalize_phone(str(raw))
        if len(digits) == 10:
            return digits
    return ""


@transaction.atomic
def register_baaris_citizen(validated: dict[str, Any], user) -> BaarisRegisterResult:
    today = timezone.now().date()
    phone = _primary_phone(validated)
    address_county = validated.get("address_county_obj")
    district_name = (
        address_county.name
        if address_county is not None
        else (validated.get("district") or "—")
    )

    dob = validated.get("date_of_birth")
    age = validated.get("age_reported")
    if dob and not age:
        try:
            age = max(0, today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day)))
        except Exception:
            age = None

    suspect = Suspect.objects.create(
        name=validated["name"],
        mother_name=validated.get("mother") or "",
        gender=validated.get("gender") or "",
        phone=phone,
        occupation=validated.get("nuuca_shaqada") or validated.get("occupation") or "",
        goobta_shaqada=validated.get("goobta_shaqada") or "",
        lambarka_diiwaanka=validated.get("nira") or validated.get("identity_card") or "",
        address=address_county,
        marriage_status=validated.get("xaaladda_guurka") or "",
        children=int(validated.get("tirada_carruurta") or 0) if (validated.get("xaaladda_guurka") or "") == "Guurday" else 0,
        tribe=validated.get("qabiilka") or "",
        xabsi_waligaa_ma_soo_martay=validated.get("horay_maloo_xiray") or "",
        date_of_birth=dob,
        notes=validated.get("qoraallo_dheeraad") or "",
        offense="Baaris — Aqoonsi",
        district=district_name,
        case_ref=f"BAR-{timezone.now().strftime('%Y%m%d%H%M%S%f')}",
        last_seen=today,
        date_opp=today,
        day=f"{today.day:02d}",
        month=f"{today.month:02d}",
        year=str(today.year),
        created_by=user,
        source=Suspect.Source.BAARIS,
        status=Suspect.Status.WATCHING,
        risk=Suspect.Risk.LOW,
    )

    # Officer verification is automatic from the logged-in TipPhone user.
    officer_name = (
        f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        or getattr(user, "username", "")
        or ""
    )
    county = getattr(user, "county", None)
    officer_place = county.name if county is not None else ""

    housing = (validated.get("ijaar_ama_milkiyad") or "").strip()
    landlord = validated.get("yaa_ka_ijaaray") or "" if housing == "Ijaar" else ""
    marital = (validated.get("xaaladda_guurka") or "").strip()
    children = int(validated.get("tirada_carruurta") or 0) if marital == "Guurday" else 0

    profile = BaarisCitizenProfile.objects.create(
        suspect=suspect,
        waaxda=validated.get("waaxda") or "",
        xaafadda=validated.get("xaafadda") or "",
        ijaar_ama_milkiyad=housing,
        mudada_uu_deggan_yahay=validated.get("mudada_uu_deggan_yahay") or "",
        yaa_ka_ijaaray=landlord,
        deegaannadiisa_hore=validated.get("deegaannadiisa_hore") or "",
        hormuud=normalize_phone(str(validated.get("hormuud") or phone)),
        somnet=normalize_phone(str(validated.get("somnet") or "")),
        somtel=normalize_phone(str(validated.get("somtel") or "")),
        nuuca_shaqada=validated.get("nuuca_shaqada") or "",
        goobta_shaqada=validated.get("goobta_shaqada") or "",
        maamulaha_shaqada=validated.get("maamulaha_shaqada") or "",
        muddada_shaqada=validated.get("muddada_shaqada") or "",
        shaqooyin_hore=validated.get("shaqooyin_hore") or "",
        xaaladda_guurka=marital,
        tirada_carruurta=children,
        tirada_dadka_guriga=int(validated.get("tirada_dadka_guriga") or 0),
        qof_degdeg=validated.get("qof_degdeg") or "",
        xaasas_hore=validated.get("xaasas_hore") or "",
        qabiilka=validated.get("qabiilka") or "",
        gobolka_kasoo_jeedo=validated.get("gobolka_kasoo_jeedo") or "",
        nabadoonkiisa=validated.get("nabadoonkiisa") or "",
        xubnaha_qoyska_dowlad=validated.get("xubnaha_qoyska_dowlad") or "",
        dhaawaco_rasaas=validated.get("dhaawaco_rasaas") or "",
        calaamado_aqoonsi=validated.get("calaamado_aqoonsi") or "",
        horay_maloo_xiray=validated.get("horay_maloo_xiray") or "",
        # Vehicles live on SuspectCar (profile attach), same as amniga suspects.
        gaadiid_nooca="",
        gaadiid_taargada="",
        gaadiid_lisence="",
        gaadiid_milkiyad_mise_ijaar="",
        nira=validated.get("nira") or "",
        baasaboor=validated.get("baasaboor") or "",
        license_doc=validated.get("license_doc") or "",
        qoraallo_dheeraad=validated.get("qoraallo_dheeraad") or "",
        form_number=validated.get("form_number") or "",
        sarkaalka_magaca=officer_name,
        goobta_xaqiijinta=officer_place,
        taariikhda_xaqiijinta=today,
        age_reported=age,
        created_by=user,
    )

    if validated.get("picture"):
        schedule_photo_updates([("suspect", suspect.pk, "photo_url", validated["picture"])])

    # Do NOT call after_suspect_registered here:
    # - It creates an Amniga SuspectResponse ("Tuhunsane") and sync FCM broadcast
    # - Celery often unavailable locally → sync FCM hangs/kills the request
    # Baaris is citizen ID, not an amniga suspect alert.
    return BaarisRegisterResult(suspect=suspect, profile=profile)
