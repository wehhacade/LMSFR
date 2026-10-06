"""Slim 3-step registration payload — suspect, case, damiin in one request."""

from __future__ import annotations

from rest_framework import serializers

from apps.suspects.models import Suspect, SuspectStatus

from .face_service import normalize_phone
from .legacy_resolve import resolve_county, resolve_sub_county
from .photo_utils import picture_payload_present
from .serializers import LegacyPictureField


def _first_value(data, *keys, default=""):
    for key in keys:
        if key not in data:
            continue
        value = data.get(key)
        if isinstance(value, list):
            value = value[0] if value else None
        if value not in (None, "", "null", "undefined"):
            return value
    return default


def _validate_phone(value: str, *, field: str) -> str:
    digits = normalize_phone(value or "")
    if len(digits) != 10 or not digits.isdigit():
        raise serializers.ValidationError(
            {field: "Lambarka waa inuu ka koobnaadaa 9 lambar (tusaale 61xxxxxxx)."}
        )
    return digits


class SimplifiedRegisterSerializer(serializers.Serializer):
    # ── Tuhunsanaha ──
    picture = LegacyPictureField(required=False, write_only=True)
    picture_base64 = serializers.CharField(required=False, allow_blank=True, write_only=True)
    fullname = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    mother = serializers.CharField(required=False, allow_blank=True)
    gender = serializers.CharField(required=False, allow_blank=True)
    identity_card = serializers.CharField(required=False, allow_blank=True)
    occupation = serializers.CharField(required=False, allow_blank=True)
    address_county = serializers.CharField(required=False, allow_blank=True)

    # ── Case ──
    suspect_type = serializers.IntegerField(required=False, allow_null=True)
    capture_county = serializers.CharField(required=False, allow_blank=True)
    capture_sub_county = serializers.CharField(required=False, allow_blank=True)
    faahfaahin = serializers.CharField(required=False, allow_blank=True)

    # ── Damiin ──
    doorasho = serializers.CharField(required=False, allow_blank=True, default="new_damiin")
    damiin_id = serializers.IntegerField(required=False, allow_null=True)
    damiin_picture = LegacyPictureField(required=False, write_only=True)
    damiin_name = serializers.CharField(required=False, allow_blank=True)
    damiin_gender = serializers.CharField(required=False, allow_blank=True)
    damiin_phone = serializers.CharField(required=False, allow_blank=True)
    damiin_identity_picture = LegacyPictureField(required=False, write_only=True)
    relationship = serializers.JSONField(required=False, allow_null=True)
    damiin_county = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        data = self.initial_data
        errors: dict[str, str] = {}

        picture = attrs.get("picture")
        b64 = (attrs.pop("picture_base64", None) or "").strip()
        if not picture and b64:
            attrs["picture"] = b64
            picture = b64
        if not picture and not picture_payload_present(_first_value(data, "picture", "picture_base64")):
            errors["picture"] = "Fadlan sawir ka qaad tuhunsaha."

        fullname = (attrs.get("fullname") or "").strip()
        if not fullname:
            errors["fullname"] = "Fadlan qor magaca tuhunsaha."
        else:
            attrs["fullname"] = fullname

        mother = (attrs.get("mother") or "").strip()
        if not mother:
            errors["mother"] = "Fadlan qor magaca hooyada."
        else:
            attrs["mother"] = mother

        for key, msg in (
            ("gender", "Fadlan dooro jinsiga."),
            ("occupation", "Fadlan qor shaqada."),
            ("identity_card", "Fadlan qor lambarka aqoonsiga."),
        ):
            value = (attrs.get(key) or "").strip()
            if not value:
                errors[key] = msg
            else:
                attrs[key] = value

        phone_raw = (attrs.get("phone") or "").strip()
        if not phone_raw:
            errors["phone"] = "Fadlan qor lambarka telefoonka."
        else:
            try:
                attrs["phone"] = _validate_phone(phone_raw, field="phone")
            except serializers.ValidationError as exc:
                errors.update(exc.detail)

        address_county = resolve_county(attrs.get("address_county"))
        if not address_county:
            errors["address_county"] = "Fadlan dooro degmada uu deggan yahay."
        else:
            attrs["address_county_obj"] = address_county

        suspect_type_id = attrs.get("suspect_type")
        if not suspect_type_id:
            errors["suspect_type"] = "Fadlan dooro tuhunka."
        elif not SuspectStatus.objects.filter(pk=suspect_type_id).exists():
            errors["suspect_type"] = "Nooca tuhunka lama helin."
        else:
            attrs["suspect_type_obj"] = SuspectStatus.objects.only("id", "name").get(pk=suspect_type_id)

        capture_county = resolve_county(attrs.get("capture_county"))
        if not capture_county:
            errors["capture_county"] = "Fadlan dooro degmada qabashada."
        else:
            attrs["capture_county_obj"] = capture_county

        capture_sub = resolve_sub_county(attrs.get("capture_sub_county"), county=capture_county)
        if not capture_sub:
            errors["capture_sub_county"] = "Fadlan dooro waaxda qabashada."
        else:
            attrs["capture_sub_county_obj"] = capture_sub

        faahfaahin = (attrs.get("faahfaahin") or "").strip()
        if not faahfaahin:
            errors["faahfaahin"] = "Fadlan qor faahfaahinta."
        else:
            attrs["faahfaahin"] = faahfaahin

        doorasho = (attrs.get("doorasho") or "new_damiin").strip().lower()
        attrs["doorasho"] = doorasho

        if doorasho == "no_damiin":
            pass
        elif doorasho in ("dhamaan_damiin", "isla_damiin"):
            if not attrs.get("damiin_id"):
                errors["damiin_id"] = "Fadlan dooro Damiinada."
        else:
            damiin_name = (attrs.get("damiin_name") or "").strip()
            if not damiin_name:
                errors["damiin_name"] = "Fadlan qor magaca Damiinada."
            else:
                attrs["damiin_name"] = damiin_name

            damiin_gender = (attrs.get("damiin_gender") or "").strip()
            if not damiin_gender:
                errors["damiin_gender"] = "Fadlan dooro jinsiga Damiinada."
            else:
                attrs["damiin_gender"] = damiin_gender

            damiin_phone_raw = (attrs.get("damiin_phone") or "").strip()
            if not damiin_phone_raw:
                errors["damiin_phone"] = "Fadlan qor lambarka Damiinada."
            else:
                try:
                    attrs["damiin_phone"] = _validate_phone(damiin_phone_raw, field="damiin_phone")
                except serializers.ValidationError as exc:
                    errors.update(exc.detail)

            if not attrs.get("damiin_identity_picture") and not picture_payload_present(
                _first_value(data, "damiin_identity_picture")
            ):
                errors["damiin_identity_picture"] = "Fadlan soo geli sawirka aqoonsiga Damiinada."

            if attrs.get("relationship") in (None, "", 0, "0"):
                errors["relationship"] = "Fadlan dooro xiriirka."

            damiin_county = resolve_county(attrs.get("damiin_county"))
            if not damiin_county:
                errors["damiin_county"] = "Fadlan dooro degmada Damiinada."
            else:
                attrs["damiin_county_obj"] = damiin_county

        if errors:
            raise serializers.ValidationError(errors)

        if attrs["phone"] and Suspect.objects.filter(phone=attrs["phone"]).exists():
            existing = Suspect.objects.filter(phone=attrs["phone"]).only("name").first()
            raise serializers.ValidationError(
                {"phone": f"Lambarkaan hore ayaa loo diiwaan geliyey ({existing.name})."}
            )

        if (
            Suspect.objects.filter(
                name=attrs["fullname"],
                mother_name=attrs["mother"],
            ).exists()
        ):
            raise serializers.ValidationError(
                {"fullname": "Tuhunsanahaan waa diiwaan gashanyahay."}
            )

        return attrs
