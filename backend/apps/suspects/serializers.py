from rest_framework import serializers

from .face_service import normalize_phone
from .legacy_resolve import resolve_county, resolve_country, resolve_sub_county
from .models import (
    Damiinada,
    Suspect,
    SuspectArrest,
    SuspectCase,
    SuspectComment,
    SuspectStatus,
    visible_bail_count,
)
from .photo_utils import (
    coerce_picture_upload,
    persist_suspect_photo,
    picture_payload_present,
    resolve_photo_url,
    store_damiin_picture,
)


class LegacyPictureField(serializers.Field):
    """Multipart file, data-URL, or base64 string (Postman JSON testing)."""

    def to_internal_value(self, data):
        if data is None or data == "":
            return None
        upload = coerce_picture_upload(data)
        if upload is not None:
            return upload
        if isinstance(data, str) and data.strip():
            if not picture_payload_present(data):
                raise serializers.ValidationError(
                    "Magaca file (tusaale w.jpg) ma shaqeynayo — isticmaal File upload, "
                    "base64, ama data:image/jpeg;base64,..."
                )
        raise serializers.ValidationError(
            "The submitted data was not a file. Check the encoding type on the form."
        )

    def to_representation(self, value):
        return None


class SuspectPictureWriteMixin:
    def _save_picture(self, instance: Suspect, picture) -> Suspect:
        if picture:
            instance.photo_url = persist_suspect_photo(instance.pk, picture)
            instance.save(update_fields=["photo_url", "updated_at"])
        return instance


class SuspectStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuspectStatus
        fields = ("id", "name")


class BailCountDisplayMixin:
    def get_bail_count(self, obj: Suspect) -> int:
        return visible_bail_count(getattr(obj, "bail_count", 0))


class SuspectListSerializer(BailCountDisplayMixin, serializers.ModelSerializer):
    photo = serializers.SerializerMethodField()
    bail_count = serializers.SerializerMethodField()
    suspect_type_name = serializers.CharField(source="suspect_type.name", read_only=True, default=None)
    capture_county_name = serializers.CharField(source="capture_county.name", read_only=True, default=None)
    created_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)

    class Meta:
        model = Suspect
        fields = (
            "id",
            "name",
            "alias",
            "photo",
            "district",
            "capture_county_name",
            "case_ref",
            "status",
            "risk",
            "suspect_type",
            "suspect_type_name",
            "last_seen",
            "created_at",
            "offense",
            "bail_count",
        )

    def get_photo(self, obj: Suspect) -> str:
        return resolve_photo_url(obj.photo_url, self.context.get("request"))


class LegacySuspectListSerializer(BailCountDisplayMixin, serializers.ModelSerializer):
    fullname = serializers.CharField(source="name")
    nickname = serializers.CharField(source="alias")
    photo = serializers.SerializerMethodField()
    is_released = serializers.SerializerMethodField()
    bail_count = serializers.SerializerMethodField()
    N_tuhunka = serializers.CharField(source="suspect_type.name", read_only=True, default=None)

    class Meta:
        model = Suspect
        fields = (
            "id",
            "fullname",
            "nickname",
            "photo",
            "district",
            "status",
            "risk",
            "last_seen",
            "offense",
            "is_released",
            "bail_count",
            "case_ref",
            "N_tuhunka",
        )

    def get_is_released(self, obj: Suspect) -> bool:
        return obj.status == Suspect.Status.CLEARED

    def get_photo(self, obj: Suspect) -> str:
        return resolve_photo_url(obj.photo_url, self.context.get("request"))


class LegacySuspectWriteSerializer(SuspectPictureWriteMixin, serializers.ModelSerializer):
    fullname = serializers.CharField(required=False, write_only=True)
    nickname = serializers.CharField(required=False, write_only=True, allow_blank=True)
    mother = serializers.CharField(required=False, write_only=True, allow_blank=True)
    mother_name = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, write_only=True, allow_blank=True)
    dob = serializers.DateField(required=False, write_only=True, allow_null=True)
    pob = serializers.CharField(required=False, write_only=True, allow_blank=True)
    phone_self = serializers.CharField(required=False, write_only=True, allow_blank=True)
    parent_phone = serializers.CharField(required=False, write_only=True, allow_blank=True)
    marital = serializers.CharField(required=False, write_only=True, allow_blank=True)
    place_occupation = serializers.CharField(required=False, write_only=True, allow_blank=True)
    identity_card = serializers.CharField(required=False, write_only=True, allow_blank=True)
    suspect_type = serializers.PrimaryKeyRelatedField(
        queryset=SuspectStatus.objects.all(),
        required=False,
        allow_null=True,
    )
    suspect_type_id = serializers.PrimaryKeyRelatedField(
        queryset=SuspectStatus.objects.all(),
        source="suspect_type",
        required=False,
        allow_null=True,
        write_only=True,
    )
    county = serializers.CharField(required=False, write_only=True, allow_null=True, allow_blank=True)
    sub_county = serializers.CharField(required=False, write_only=True, allow_null=True, allow_blank=True)
    address = serializers.CharField(required=False, write_only=True, allow_null=True, allow_blank=True)
    nationality = serializers.CharField(required=False, write_only=True, allow_null=True, allow_blank=True)
    photo = serializers.URLField(source="photo_url", required=False, allow_blank=True)
    picture = LegacyPictureField(write_only=True, required=False)
    picture_base64 = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Suspect
        fields = (
            "fullname",
            "nickname",
            "mother",
            "mother_name",
            "description",
            "dob",
            "pob",
            "gender",
            "nationality",
            "phone_self",
            "phone",
            "parent_phone",
            "father_contact",
            "mother_contact",
            "marital",
            "marriage_status",
            "children",
            "occupation",
            "place_occupation",
            "goobta_shaqada",
            "tribe",
            "identity_card",
            "lambarka_diiwaanka",
            "xabsi_waligaa_ma_soo_martay",
            "address",
            "county",
            "sub_county",
            "latitude",
            "longitude",
            "suspect_identifier",
            "photo",
            "picture",
            "picture_base64",
            "district",
            "case_ref",
            "status",
            "risk",
            "suspect_type",
            "suspect_type_id",
            "date_of_birth",
            "goobta_dhalashada",
            "last_seen",
            "offense",
            "notes",
            "name",
            "alias",
        )
        extra_kwargs = {
            "name": {"required": False},
            "alias": {"required": False},
            "case_ref": {"required": False},
            "district": {"required": False},
            "last_seen": {"required": False},
            "offense": {"required": False},
            "phone": {"required": False},
            "children": {"required": False},
        }

    def validate_phone(self, value: str) -> str:
        digits = normalize_phone(value or "")
        if not digits:
            return ""
        if len(digits) != 10 or not digits.isdigit():
            raise serializers.ValidationError(
                "Lambarka Telefanka waa inuu ka koobnaadaa 9 lambar (tusaale 61xxxxxxx)."
            )
        existing = Suspect.objects.filter(phone=digits).only("id", "name").first()
        if existing and (not self.instance or existing.pk != self.instance.pk):
            raise serializers.ValidationError(
                f"Lambarkaan {digits}, hore ayaa loo diiwaan geliyey waxaana wato qof magaciisu yahay {existing.name}"
            )
        return digits

    def validate_children(self, value):
        if value is None:
            return 0
        if not 0 <= int(value) <= 20:
            raise serializers.ValidationError("Children must be a number between 0 and 20.")
        return int(value)

    def validate(self, attrs):
        if not attrs.get("name") and attrs.get("fullname"):
            attrs["name"] = attrs.pop("fullname")
        elif "fullname" in attrs:
            attrs.pop("fullname", None)
        if not attrs.get("alias") and attrs.get("nickname"):
            attrs["alias"] = attrs.pop("nickname")
        elif "nickname" in attrs:
            attrs.pop("nickname", None)
        if not attrs.get("mother_name") and attrs.get("mother"):
            attrs["mother_name"] = attrs.pop("mother")
        elif "mother" in attrs:
            attrs.pop("mother", None)
        if attrs.get("description") and not attrs.get("notes"):
            attrs["notes"] = attrs.pop("description")
        elif "description" in attrs:
            attrs.pop("description", None)
        if attrs.get("dob") and not attrs.get("date_of_birth"):
            attrs["date_of_birth"] = attrs.pop("dob")
        elif "dob" in attrs:
            attrs.pop("dob", None)
        if attrs.get("pob") and not attrs.get("goobta_dhalashada"):
            attrs["goobta_dhalashada"] = attrs.pop("pob")
        elif "pob" in attrs:
            attrs.pop("pob", None)
        if attrs.get("phone_self") and not attrs.get("phone"):
            attrs["phone"] = attrs.pop("phone_self")
        elif "phone_self" in attrs:
            attrs.pop("phone_self", None)
        if attrs.get("parent_phone") and not attrs.get("father_contact"):
            attrs["father_contact"] = attrs.pop("parent_phone")
        elif "parent_phone" in attrs:
            attrs.pop("parent_phone", None)
        if attrs.get("marital") and not attrs.get("marriage_status"):
            attrs["marriage_status"] = attrs.pop("marital")
        elif "marital" in attrs:
            attrs.pop("marital", None)
        if attrs.get("place_occupation") and not attrs.get("goobta_shaqada"):
            attrs["goobta_shaqada"] = attrs.pop("place_occupation")
        elif "place_occupation" in attrs:
            attrs.pop("place_occupation", None)
        if attrs.get("identity_card") and not attrs.get("lambarka_diiwaanka"):
            attrs["lambarka_diiwaanka"] = attrs.pop("identity_card")
        elif "identity_card" in attrs:
            attrs.pop("identity_card", None)

        county_raw = attrs.pop("county", None)
        if county_raw not in (None, "", "0"):
            county = resolve_county(county_raw)
            if not county:
                raise serializers.ValidationError({"county": "Degmo sax ah dooro."})
            attrs["capture_county"] = county
            if not attrs.get("district"):
                attrs["district"] = county.name

        sub_raw = attrs.pop("sub_county", None)
        if sub_raw not in (None, "", "0"):
            county = attrs.get("capture_county")
            sub = resolve_sub_county(sub_raw, county=county)
            if not sub:
                raise serializers.ValidationError({"sub_county": "Waax sax ah dooro."})
            attrs["capture_sub_county"] = sub

        address_raw = attrs.pop("address", None)
        if address_raw not in (None, "", "0"):
            address = resolve_county(address_raw)
            if not address:
                raise serializers.ValidationError({"address": "Cinwaan degmo sax ah dooro."})
            attrs["address"] = address

        nationality_raw = attrs.pop("nationality", None)
        if nationality_raw not in (None, "", "0"):
            country = resolve_country(nationality_raw)
            if not country:
                raise serializers.ValidationError({"nationality": "Dhalasho sax ah dooro."})
            attrs["nationality"] = country

        b64 = attrs.pop("picture_base64", None)
        if b64 and not attrs.get("picture"):
            attrs["picture"] = b64

        if not attrs.get("name"):
            raise serializers.ValidationError({"fullname": "Magaca qofka waa lama huraan."})
        return attrs

    def create(self, validated_data):
        from django.utils import timezone

        today = timezone.now().date()
        validated_data.setdefault("case_ref", f"LEG-{timezone.now().strftime('%Y%m%d%H%M%S%f')}")
        validated_data.setdefault("district", validated_data.get("district") or "Hodan")
        validated_data.setdefault("date_of_birth", validated_data.get("date_of_birth") or today)
        validated_data.setdefault("last_seen", validated_data.get("last_seen") or validated_data["date_of_birth"])
        validated_data.setdefault("offense", validated_data.get("offense") or "—")
        validated_data.setdefault("date_opp", today)
        validated_data.setdefault("day", f"{today.day:02d}")
        validated_data.setdefault("month", f"{today.month:02d}")
        validated_data.setdefault("year", str(today.year))
        picture = validated_data.pop("picture", None)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        instance = super().create(validated_data)
        if picture:
            return self._save_picture(instance, picture)
        return instance


class RegisteredOfficerSerializer(serializers.Serializer):
    id = serializers.CharField()
    full_name = serializers.SerializerMethodField()
    username = serializers.CharField()
    profile_url = serializers.SerializerMethodField()

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.email or obj.username

    def get_profile_url(self, obj) -> str | None:
        if not obj.profile or not getattr(obj.profile, "name", None):
            return None
        url = resolve_photo_url(obj.profile.name, self.context.get("request"))
        return url or None


class SuspectDetailSerializer(SuspectListSerializer):
    registered_officer = RegisteredOfficerSerializer(source="created_by", read_only=True, allow_null=True)
    capture_county_name = serializers.CharField(source="capture_county.name", read_only=True, default=None)
    capture_sub_county_name = serializers.CharField(source="capture_sub_county.name", read_only=True, default=None)
    address_name = serializers.CharField(source="address.name", read_only=True, default=None)
    nationality_name = serializers.CharField(source="nationality.name", read_only=True, default=None)
    created_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)
    updated_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)

    class Meta(SuspectListSerializer.Meta):
        fields = SuspectListSerializer.Meta.fields + (
            "mother_name",
            "date_of_birth",
            "goobta_dhalashada",
            "address",
            "address_name",
            "phone",
            "marriage_status",
            "children",
            "xabsi_waligaa_ma_soo_martay",
            "tribe",
            "occupation",
            "lambarka_diiwaanka",
            "is_released",
            "father_contact",
            "mother_contact",
            "gender",
            "goobta_shaqada",
            "nationality",
            "nationality_name",
            "latitude",
            "longitude",
            "suspect_identifier",
            "notes",
            "capture_county",
            "capture_county_name",
            "capture_sub_county",
            "capture_sub_county_name",
            "created_at",
            "updated_at",
            "registered_officer",
        )
        read_only_fields = ("created_at", "updated_at")


class SuspectWriteSerializer(SuspectPictureWriteMixin, serializers.ModelSerializer):
    photo = serializers.URLField(source="photo_url", required=False, allow_blank=True)
    picture = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = Suspect
        fields = (
            "id",
            "name",
            "alias",
            "mother_name",
            "photo",
            "picture",
            "district",
            "case_ref",
            "status",
            "risk",
            "suspect_type",
            "capture_county",
            "capture_sub_county",
            "address",
            "date_of_birth",
            "goobta_dhalashada",
            "phone",
            "marriage_status",
            "children",
            "xabsi_waligaa_ma_soo_martay",
            "tribe",
            "occupation",
            "lambarka_diiwaanka",
            "gender",
            "goobta_shaqada",
            "nationality",
            "father_contact",
            "mother_contact",
            "latitude",
            "longitude",
            "suspect_identifier",
            "last_seen",
            "offense",
            "notes",
        )
        read_only_fields = ("id",)

    def create(self, validated_data):
        picture = validated_data.pop("picture", None)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        instance = super().create(validated_data)
        if picture:
            return self._save_picture(instance, picture)
        return instance

    def update(self, instance, validated_data):
        picture = validated_data.pop("picture", None)
        instance = super().update(instance, validated_data)
        if picture:
            return self._save_picture(instance, picture)
        return instance


class SuspectCaseSerializer(serializers.ModelSerializer):
    tuhunka_name = serializers.CharField(source="tuhunka.name", read_only=True, default=None)
    damiin_name = serializers.CharField(source="damiin.name", read_only=True, default=None)
    capture_county_name = serializers.CharField(source="capture_county.name", read_only=True, default=None)
    capture_sub_county_name = serializers.CharField(source="capture_sub_county.name", read_only=True, default=None)

    class Meta:
        model = SuspectCase
        fields = (
            "id",
            "case_code",
            "suspect",
            "damiin",
            "damiin_name",
            "tuhunka",
            "tuhunka_name",
            "capture_county",
            "capture_county_name",
            "capture_sub_county",
            "capture_sub_county_name",
            "description",
            "created_at",
        )
        read_only_fields = ("id", "case_code", "created_at")


class DamiinadaSerializer(serializers.ModelSerializer):
    county_name = serializers.CharField(source="county.name", read_only=True, default=None)
    sub_county_name = serializers.CharField(source="sub_county.name", read_only=True, default=None)
    degmada = serializers.CharField(source="county.name", read_only=True, default=None)
    relationship_name = serializers.CharField(source="new_relationship.relationship", read_only=True, default=None)
    full_name = serializers.CharField(source="name", read_only=True)
    picture = serializers.SerializerMethodField()
    identity_picture = serializers.SerializerMethodField()
    cases = serializers.SerializerMethodField()

    class Meta:
        model = Damiinada
        fields = (
            "id",
            "code",
            "name",
            "full_name",
            "phone",
            "new_relationship",
            "relationship",
            "relationship_name",
            "county",
            "county_name",
            "sub_county",
            "sub_county_name",
            "degmada",
            "occupation",
            "workplace",
            "description",
            "picture",
            "identity_picture",
            "created_at",
            "cases",
        )
        read_only_fields = ("id", "code", "created_at", "full_name")

    def get_picture(self, obj: Damiinada) -> str | None:
        url = resolve_photo_url(obj.picture_url, self.context.get("request"))
        return url or None

    def get_identity_picture(self, obj: Damiinada) -> str | None:
        url = resolve_photo_url(obj.identity_picture_url, self.context.get("request"))
        return url or None

    def get_cases(self, obj: Damiinada):
        suspect_id = self.context.get("suspect_id")
        qs = obj.cases.select_related("tuhunka", "capture_county", "capture_sub_county")
        if suspect_id:
            qs = qs.filter(suspect_id=suspect_id)
        return [
            {
                "id": case.id,
                "case_code": case.case_code,
                "Tuhunka": case.tuhunka.name if case.tuhunka else None,
                "d_qabashada": case.capture_county.name if case.capture_county else None,
                "w_qabashada": case.capture_sub_county.name if case.capture_sub_county else None,
                "description": case.description,
            }
            for case in qs.order_by("-created_at")[:20]
        ]


class DamiinadaPhotoUpdateSerializer(serializers.Serializer):
    """Multipart / base64 uploads for damiin profile + identity document."""

    picture = LegacyPictureField(required=False)
    identity_picture = LegacyPictureField(required=False)

    def validate(self, attrs):
        if not attrs.get("picture") and not attrs.get("identity_picture"):
            raise serializers.ValidationError(
                "Fadlan soo geli sawirka profile ama dukumeentiga aqoonsiga."
            )
        return attrs

    def save(self, *, damiin: Damiinada) -> Damiinada:
        updates: dict = {}
        picture = self.validated_data.get("picture")
        identity = self.validated_data.get("identity_picture")
        if picture is not None:
            updates["picture_url"] = store_damiin_picture(picture)
        if identity is not None:
            updates["identity_picture_url"] = store_damiin_picture(identity)
        if updates:
            Damiinada.objects.filter(pk=damiin.pk).update(**updates)
            damiin.refresh_from_db()
        return damiin


class LegacyGuarantorSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="name", required=False)
    full_name = serializers.CharField(source="name", required=False)
    description = serializers.CharField(source="description", required=False, allow_blank=True)
    degmada = serializers.CharField(source="county.name", read_only=True, default=None)

    class Meta:
        model = Damiinada
        fields = (
            "id",
            "code",
            "name",
            "full_name",
            "phone",
            "relationship",
            "county",
            "degmada",
            "occupation",
            "workplace",
            "description",
            "created_at",
        )
        read_only_fields = ("id", "code", "created_at")


class DamiinCaseCreateSerializer(serializers.Serializer):
    suspect_id = serializers.IntegerField(required=False)
    suspect = serializers.IntegerField(required=False)
    doorasho = serializers.CharField(required=False, allow_blank=True)
    damiin_id = serializers.IntegerField(required=False, allow_null=True)
    names = serializers.CharField(required=False, allow_blank=True)
    name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    relationship = serializers.JSONField(required=False, allow_null=True)
    occupation = serializers.CharField(required=False, allow_blank=True)
    goobta_shaqada = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    degmada_laga_qabtay = serializers.IntegerField(required=False, allow_null=True)
    damiin_sub_county = serializers.IntegerField(required=False, allow_null=True)
    degmada_qabashada = serializers.IntegerField(required=False, allow_null=True)
    sub_county = serializers.IntegerField(required=False, allow_null=True)
    reason = serializers.IntegerField(required=False, allow_null=True)
    faahfaahin = serializers.CharField(required=False, allow_blank=True)
    damiin_picture = LegacyPictureField(required=False, write_only=True)
    damiin_identity_picture = LegacyPictureField(required=False, write_only=True)


class SuspectArrestSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuspectArrest
        fields = (
            "id",
            "suspect",
            "officer_name",
            "officer_badge",
            "unit",
            "arrested_at",
            "location",
            "notes",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class SuspectCommentReplySerializer(serializers.ModelSerializer):
    class Meta:
        model = SuspectComment
        fields = ("id", "author_name", "body", "parent", "created_at")
        read_only_fields = ("id", "created_at")


class SuspectCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(required=False, allow_blank=True)
    replies = SuspectCommentReplySerializer(many=True, read_only=True)
    parent = serializers.PrimaryKeyRelatedField(
        queryset=SuspectComment.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = SuspectComment
        fields = ("id", "suspect", "parent", "author_name", "body", "replies", "created_at")
        read_only_fields = ("id", "created_at", "replies")

    def create(self, validated_data):
        if not validated_data.get("author_name"):
            request = self.context.get("request")
            if request and request.user.is_authenticated:
                validated_data["author_name"] = (
                    request.user.get_full_name() or request.user.email or request.user.username
                )
        return super().create(validated_data)
