from django.db import IntegrityError, transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import serializers

from apps.suspects.photo_utils import resolve_photo_url
from apps.visitors.models import Visit, VisitAllegation, VisitDestination, Visitor
from apps.visitors.nira import (
    InvalidVisitorNira,
    is_matchable_nira,
    normalize_visitor_nira,
    store_visitor_nira,
    validate_submitted_nira,
)


def _image_url(file_field, request) -> str | None:
    if not file_field or not getattr(file_field, "name", None):
        return None
    return resolve_photo_url(file_field.name, request) or None


def _normalize_gender(value) -> str:
    raw = (str(value or "")).strip().lower()
    if raw in ("m", "male", "lab", "r"):
        return "m"
    if raw in ("f", "female", "dh", "dhedig"):
        return "f"
    if raw in ("other", "o"):
        return "other"
    return raw[:16] if raw else ""


class VisitSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    allegation_id = serializers.IntegerField(read_only=True)
    allegation_name = serializers.SerializerMethodField()

    class Meta:
        model = Visit
        fields = (
            "id",
            "visiting",
            "contact_name",
            "relationship",
            "allegation_id",
            "allegation_name",
            "sentence",
            "visited_at",
            "verified",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
        )

    def get_created_by_name(self, obj) -> str | None:
        user = obj.created_by
        if not user:
            return None
        return user.get_full_name() or user.username or user.email

    def get_allegation_name(self, obj) -> str | None:
        return obj.allegation.name if obj.allegation_id else None


class VisitorListSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    visit_count = serializers.SerializerMethodField()
    visiting = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    relationship = serializers.SerializerMethodField()
    allegation_id = serializers.SerializerMethodField()
    allegation_name = serializers.SerializerMethodField()
    sentence = serializers.SerializerMethodField()
    is_returning = serializers.SerializerMethodField()

    class Meta:
        model = Visitor
        fields = (
            "id",
            "full_name",
            "mother_name",
            "gender",
            "phone",
            "nira",
            "visited_at",
            "verified",
            "visiting",
            "contact_name",
            "relationship",
            "allegation_id",
            "allegation_name",
            "sentence",
            "visit_count",
            "is_returning",
            "image_url",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )

    def get_image_url(self, obj) -> str | None:
        return _image_url(obj.image, self.context.get("request"))

    def get_created_by_name(self, obj) -> str | None:
        user = obj.created_by
        if not user:
            return None
        return user.get_full_name() or user.username or user.email

    def get_visit_count(self, obj) -> int:
        annotated = getattr(obj, "visit_count_ann", None)
        if annotated is not None:
            return int(annotated)
        return obj.visits.count()

    def get_visiting(self, obj) -> str | None:
        visit = self._latest_visit(obj)
        return visit.visiting if visit else None

    def get_contact_name(self, obj) -> str | None:
        visit = self._latest_visit(obj)
        return visit.contact_name if visit and visit.contact_name else None

    def get_relationship(self, obj) -> str | None:
        visit = self._latest_visit(obj)
        return visit.relationship if visit and visit.relationship else None

    def get_allegation_id(self, obj) -> int | None:
        visit = self._latest_visit(obj)
        return visit.allegation_id if visit else None

    def get_allegation_name(self, obj) -> str | None:
        visit = self._latest_visit(obj)
        return visit.allegation.name if visit and visit.allegation_id else None

    def get_sentence(self, obj) -> str | None:
        visit = self._latest_visit(obj)
        return visit.sentence if visit and visit.sentence else None

    @staticmethod
    def _latest_visit(obj):
        latest = getattr(obj, "_latest_visit", None)
        if latest is not None:
            return latest
        return obj.visits.order_by("-visited_at", "-id").first()

    def get_is_returning(self, obj) -> bool:
        return self.get_visit_count(obj) > 1


class VisitorDetailSerializer(VisitorListSerializer):
    visits = VisitSerializer(many=True, read_only=True)

    class Meta(VisitorListSerializer.Meta):
        fields = VisitorListSerializer.Meta.fields + ("visits",)


class VisitorWriteSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False, allow_null=True)
    nira = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    visiting = serializers.CharField(max_length=500, write_only=True)
    contact_name = serializers.CharField(max_length=500, required=False, allow_blank=True, write_only=True)
    relationship = serializers.CharField(max_length=200, required=False, allow_blank=True, write_only=True)
    allegation_id = serializers.PrimaryKeyRelatedField(
        source="allegation",
        queryset=VisitAllegation.objects.filter(is_active=True),
        required=False,
        allow_null=True,
        write_only=True,
    )
    sentence = serializers.CharField(required=False, allow_blank=True, write_only=True)
    notes = serializers.CharField(required=False, allow_blank=True, write_only=True)
    gender = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Visitor
        fields = (
            "id",
            "full_name",
            "mother_name",
            "gender",
            "phone",
            "nira",
            "visited_at",
            "verified",
            "image",
            "visiting",
            "contact_name",
            "relationship",
            "allegation_id",
            "sentence",
            "notes",
        )

    def validate_visiting(self, value):
        text = (value or "").strip()
        if not text:
            raise serializers.ValidationError("Cida / meesha la booqanayo waa lagama maarmaan.")
        match = VisitDestination.objects.filter(is_active=True, name__iexact=text).first()
        if match:
            return match.name
        instance = getattr(self, "instance", None)
        if instance is not None:
            latest = instance.visits.order_by("-visited_at", "-id").first()
            if latest and (latest.visiting or "").strip() == text:
                return latest.visiting
        raise serializers.ValidationError("Dooro meel ka mid ah liiska.")

    def validate_gender(self, value):
        return _normalize_gender(value)

    def validate_nira(self, value):
        # Switch No → null/""; Switch Yes → valid matchable NIRA only.
        try:
            return validate_submitted_nira(value)
        except InvalidVisitorNira as exc:
            raise serializers.ValidationError(str(exc)) from exc

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        user = user if user and getattr(user, "is_authenticated", False) else None

        visiting = validated_data.pop("visiting")
        contact_name = (validated_data.pop("contact_name", "") or "").strip()
        relationship = (validated_data.pop("relationship", "") or "").strip()
        allegation = validated_data.pop("allegation", None)
        sentence = (validated_data.pop("sentence", "") or "").strip()
        notes = (validated_data.pop("notes", "") or "").strip()
        client_visited_at = validated_data.pop("visited_at", None)
        verified = bool(validated_data.get("verified", False))
        # Already validated: "" (no NIRA) or a real matchable NIRA.
        stored_nira = store_visitor_nira(validated_data.get("nira"))
        validated_data["nira"] = stored_nira
        match_key = normalize_visitor_nira(stored_nira)

        existing = None
        if is_matchable_nira(match_key):
            existing = (
                Visitor.objects.select_for_update()
                .filter(is_hidden=False, nira__iexact=match_key)
                .order_by("id")
                .first()
            )

        # Return visits always stamp "now" so prior Visit rows keep their original times.
        # First-time registration may use an explicit client datetime.
        if existing:
            visit_time = timezone.now()
        else:
            visit_time = client_visited_at or timezone.now()

        if existing:
            # Update person profile fields; keep existing image unless a new one is uploaded.
            for field in ("full_name", "mother_name", "gender", "phone"):
                if field in validated_data and validated_data[field] not in (None, ""):
                    setattr(existing, field, validated_data[field])
            if validated_data.get("image") is not None:
                existing.image = validated_data["image"]
            existing.nira = stored_nira or existing.nira
            existing.visited_at = visit_time
            existing.verified = verified
            existing.save()
            visitor = existing
            is_returning = True
        else:
            try:
                with transaction.atomic():
                    visitor = Visitor.objects.create(
                        created_by=user,
                        visited_at=visit_time,
                        verified=verified,
                        **{k: v for k, v in validated_data.items() if k not in ("verified",)},
                    )
                is_returning = False
            except IntegrityError:
                # Race: same real NIRA inserted concurrently — attach as return visit.
                if not match_key:
                    raise
                visitor = (
                    Visitor.objects.select_for_update()
                    .filter(is_hidden=False, nira__iexact=match_key)
                    .order_by("id")
                    .first()
                )
                if not visitor:
                    raise
                for field in ("full_name", "mother_name", "gender", "phone"):
                    if field in validated_data and validated_data[field] not in (None, ""):
                        setattr(visitor, field, validated_data[field])
                if validated_data.get("image") is not None:
                    visitor.image = validated_data["image"]
                visitor.nira = stored_nira or visitor.nira
                visitor.visited_at = visit_time
                visitor.verified = verified
                visitor.save()
                is_returning = True

        Visit.objects.create(
            visitor=visitor,
            visiting=visiting,
            contact_name=contact_name,
            relationship=relationship,
            allegation=allegation,
            sentence=sentence,
            visited_at=visit_time,
            verified=verified,
            notes=notes,
            created_by=user,
        )

        # Attach flag for representation
        visitor._created_as_returning = is_returning
        return visitor

    @transaction.atomic
    def update(self, instance, validated_data):
        """Edit person / latest visit details — never rewrite historical visit times."""
        visiting = validated_data.pop("visiting", None)
        contact_name = validated_data.pop("contact_name", None)
        relationship = validated_data.pop("relationship", None)
        allegation = validated_data.pop("allegation", serializers.empty)
        sentence = validated_data.pop("sentence", None)
        notes = validated_data.pop("notes", None)
        # Ignore client visited_at on update so older history cannot be overwritten.
        validated_data.pop("visited_at", None)
        verified = validated_data.get("verified")

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if visiting is not None:
            latest = instance.visits.order_by("-visited_at", "-id").first()
            if latest:
                latest.visiting = visiting
                if contact_name is not None:
                    latest.contact_name = contact_name.strip()
                if relationship is not None:
                    latest.relationship = relationship.strip()
                if allegation is not serializers.empty:
                    latest.allegation = allegation
                if sentence is not None:
                    latest.sentence = sentence.strip()
                if notes is not None:
                    latest.notes = notes
                if verified is not None:
                    latest.verified = verified
                    instance.verified = verified
                latest.save(update_fields=["visiting", "contact_name", "relationship", "allegation", "sentence", "notes", "verified"])
            else:
                request = self.context.get("request")
                user = getattr(request, "user", None) if request else None
                visit_time = timezone.now()
                Visit.objects.create(
                    visitor=instance,
                    visiting=visiting,
                    contact_name=(contact_name or "").strip(),
                    relationship=(relationship or "").strip(),
                    allegation=None if allegation is serializers.empty else allegation,
                    sentence=(sentence or "").strip(),
                    visited_at=visit_time,
                    verified=bool(verified if verified is not None else instance.verified),
                    notes=(notes or "").strip(),
                    created_by=user if user and getattr(user, "is_authenticated", False) else None,
                )
                instance.visited_at = visit_time
                if verified is not None:
                    instance.verified = verified

        instance.save()
        return instance

    def to_representation(self, instance):
        data = VisitorDetailSerializer(instance, context=self.context).data
        if getattr(instance, "_created_as_returning", False):
            data["is_returning"] = True
            data["message"] = "Wuu soo booqday"
        return data
