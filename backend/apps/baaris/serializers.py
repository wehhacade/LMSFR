from __future__ import annotations

from datetime import date

from rest_framework import serializers

from apps.accounts.models import County
from apps.baaris.models import BaarisCitizenProfile
from apps.suspects.face_service import normalize_phone
from apps.suspects.models import Suspect


def _validate_optional_phone(value: str) -> str:
    if not value:
        return ""
    digits = normalize_phone(str(value))
    if digits and len(digits) not in (9, 10):
        raise serializers.ValidationError("Lambarka telefoonka waa khaldan.")
    if len(digits) == 9 and digits[0] == "6":
        digits = f"0{digits}"
    if digits and len(digits) != 10:
        raise serializers.ValidationError("Lambarka waa inuu noqdo 10 lambar.")
    return digits


class BaarisRegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    mother = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    gender = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    age_reported = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=130)
    district = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    address_county_id = serializers.IntegerField(required=False, allow_null=True)

    waaxda = serializers.CharField(required=False, allow_blank=True, default="")
    xaafadda = serializers.CharField(required=False, allow_blank=True, default="")
    ijaar_ama_milkiyad = serializers.CharField(required=False, allow_blank=True, default="")
    mudada_uu_deggan_yahay = serializers.CharField(required=False, allow_blank=True, default="")
    yaa_ka_ijaaray = serializers.CharField(required=False, allow_blank=True, default="")
    deegaannadiisa_hore = serializers.CharField(required=False, allow_blank=True, default="")

    phone = serializers.CharField(required=False, allow_blank=True, default="")
    hormuud = serializers.CharField(required=False, allow_blank=True, default="")
    somnet = serializers.CharField(required=False, allow_blank=True, default="")
    somtel = serializers.CharField(required=False, allow_blank=True, default="")

    nuuca_shaqada = serializers.CharField(required=False, allow_blank=True, default="")
    goobta_shaqada = serializers.CharField(required=False, allow_blank=True, default="")
    maamulaha_shaqada = serializers.CharField(required=False, allow_blank=True, default="")
    muddada_shaqada = serializers.CharField(required=False, allow_blank=True, default="")
    shaqooyin_hore = serializers.CharField(required=False, allow_blank=True, default="")

    xaaladda_guurka = serializers.CharField(required=False, allow_blank=True, default="")
    tirada_carruurta = serializers.IntegerField(required=False, default=0, min_value=0)
    tirada_dadka_guriga = serializers.IntegerField(required=False, default=0, min_value=0)
    qof_degdeg = serializers.CharField(required=False, allow_blank=True, default="")
    xaasas_hore = serializers.CharField(required=False, allow_blank=True, default="")

    qabiilka = serializers.CharField(required=False, allow_blank=True, default="")
    gobolka_kasoo_jeedo = serializers.CharField(required=False, allow_blank=True, default="")
    nabadoonkiisa = serializers.CharField(required=False, allow_blank=True, default="")
    xubnaha_qoyska_dowlad = serializers.CharField(required=False, allow_blank=True, default="")
    dhaawaco_rasaas = serializers.CharField(required=False, allow_blank=True, default="")
    calaamado_aqoonsi = serializers.CharField(required=False, allow_blank=True, default="")
    horay_maloo_xiray = serializers.CharField(required=False, allow_blank=True, default="")

    gaadiid_nooca = serializers.CharField(required=False, allow_blank=True, default="")
    gaadiid_taargada = serializers.CharField(required=False, allow_blank=True, default="")
    gaadiid_lisence = serializers.CharField(required=False, allow_blank=True, default="")
    gaadiid_milkiyad_mise_ijaar = serializers.CharField(required=False, allow_blank=True, default="")

    nira = serializers.CharField(required=False, allow_blank=True, default="")
    baasaboor = serializers.CharField(required=False, allow_blank=True, default="")
    license_doc = serializers.CharField(required=False, allow_blank=True, default="")
    qoraallo_dheeraad = serializers.CharField(required=False, allow_blank=True, default="")
    form_number = serializers.CharField(required=False, allow_blank=True, default="")
    sarkaalka_magaca = serializers.CharField(required=False, allow_blank=True, default="")
    goobta_xaqiijinta = serializers.CharField(required=False, allow_blank=True, default="")
    taariikhda_xaqiijinta = serializers.CharField(required=False, allow_blank=True, default="")

    picture = serializers.ImageField(required=False, allow_null=True)

    def validate_phone(self, value):
        return _validate_optional_phone(value)

    def validate_hormuud(self, value):
        return _validate_optional_phone(value)

    def validate_somnet(self, value):
        return _validate_optional_phone(value)

    def validate_somtel(self, value):
        return _validate_optional_phone(value)

    def validate(self, attrs):
        phones = [attrs.get("hormuud"), attrs.get("phone"), attrs.get("somnet"), attrs.get("somtel")]
        primary = next((p for p in phones if p), "")
        if not primary:
            raise serializers.ValidationError(
                {"hormuud": "Ugu yaraan hal lambar telefoon ah ayaa loo baahan yahay."}
            )

        # Global anti-duplicate across amniga + baaris (shared identity).
        existing_phone = Suspect.objects.filter(phone=primary).only("id", "name", "source").first()
        if existing_phone:
            raise serializers.ValidationError(
                {
                    "hormuud": (
                        f"Lambarkaan hore ayaa loo diiwaan geliyey "
                        f"({existing_phone.name}, {existing_phone.source})."
                    )
                }
            )

        mother = (attrs.get("mother") or "").strip()
        if mother and Suspect.objects.filter(name=attrs["name"], mother_name=mother).exists():
            raise serializers.ValidationError(
                {"name": "Qofkaan waa diiwaan gashan yahay (magac + hooyo)."}
            )

        county_id = attrs.get("address_county_id")
        if county_id:
            try:
                attrs["address_county_obj"] = County.objects.get(pk=county_id)
            except County.DoesNotExist as exc:
                raise serializers.ValidationError({"address_county_id": "Degmada lama helin."}) from exc
        else:
            attrs["address_county_obj"] = None

        return attrs


class BaarisProfileSerializer(serializers.ModelSerializer):
    suspect_id = serializers.IntegerField(source="suspect.id", read_only=True)
    name = serializers.CharField(source="suspect.name", read_only=True)
    mother = serializers.CharField(source="suspect.mother_name", read_only=True)
    phone = serializers.CharField(source="suspect.phone", read_only=True)
    photo = serializers.SerializerMethodField()
    gender = serializers.CharField(source="suspect.gender", read_only=True)
    date_of_birth = serializers.DateField(source="suspect.date_of_birth", read_only=True)
    district = serializers.CharField(source="suspect.district", read_only=True)
    source = serializers.CharField(source="suspect.source", read_only=True)
    status = serializers.CharField(source="suspect.status", read_only=True)
    case_ref = serializers.CharField(source="suspect.case_ref", read_only=True)
    registered_by = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(source="suspect.created_at", read_only=True)

    class Meta:
        model = BaarisCitizenProfile
        fields = (
            "id",
            "suspect_id",
            "name",
            "mother",
            "phone",
            "photo",
            "gender",
            "date_of_birth",
            "district",
            "source",
            "status",
            "case_ref",
            "registered_by",
            "created_at",
            "waaxda",
            "xaafadda",
            "ijaar_ama_milkiyad",
            "mudada_uu_deggan_yahay",
            "yaa_ka_ijaaray",
            "deegaannadiisa_hore",
            "hormuud",
            "somnet",
            "somtel",
            "nuuca_shaqada",
            "goobta_shaqada",
            "maamulaha_shaqada",
            "muddada_shaqada",
            "shaqooyin_hore",
            "xaaladda_guurka",
            "tirada_carruurta",
            "tirada_dadka_guriga",
            "qof_degdeg",
            "xaasas_hore",
            "qabiilka",
            "gobolka_kasoo_jeedo",
            "nabadoonkiisa",
            "xubnaha_qoyska_dowlad",
            "dhaawaco_rasaas",
            "calaamado_aqoonsi",
            "horay_maloo_xiray",
            "gaadiid_nooca",
            "gaadiid_taargada",
            "gaadiid_lisence",
            "gaadiid_milkiyad_mise_ijaar",
            "nira",
            "baasaboor",
            "license_doc",
            "qoraallo_dheeraad",
            "form_number",
            "sarkaalka_magaca",
            "goobta_xaqiijinta",
            "taariikhda_xaqiijinta",
            "age_reported",
        )

    def get_photo(self, obj):
        from apps.suspects.photo_utils import resolve_photo_url

        request = self.context.get("request")
        return resolve_photo_url(obj.suspect.photo_url, request)

    def get_registered_by(self, obj):
        user = obj.created_by or obj.suspect.created_by
        if not user:
            return ""
        return f"{user.first_name} {user.last_name}".strip() or user.username
