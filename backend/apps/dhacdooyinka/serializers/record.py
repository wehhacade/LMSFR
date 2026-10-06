import json
import os
import random

from django.utils import timezone
from rest_framework import serializers

from apps.dhacdooyinka.models import (
    DhacdoDocuments,
    Dhacdooyinka,
    Dhibanayaashas,
    Dhibane_documents,
    Faahfaahinta,
)
from apps.dhacdooyinka.services.geocode import target_location_name
from apps.suspects.photo_utils import resolve_photo_url


def generate_tixraac_lambar() -> str:
    now = timezone.now()
    suffix = random.randint(1000, 9999)
    return f"Txl-{now.strftime('%y%m%d')}{suffix}"


def _file_name(file_field) -> str | None:
    if not file_field or not getattr(file_field, "name", None):
        return None
    return os.path.basename(str(file_field.name))


def _file_url(file_field, request) -> str | None:
    if not file_field or not getattr(file_field, "name", None):
        return None
    return resolve_photo_url(file_field.name, request) or None


class DhibaneDocumentSerializer(serializers.ModelSerializer):
    document_url = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = Dhibane_documents
        fields = ("id", "name", "document_url")

    def get_name(self, obj) -> str | None:
        return _file_name(obj.document)

    def get_document_url(self, obj) -> str | None:
        return _file_url(obj.document, self.context.get("request"))


class DhacdoDocumentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = DhacdoDocuments
        fields = ("id", "name", "url")

    def get_name(self, obj) -> str | None:
        return _file_name(obj.name)

    def get_url(self, obj) -> str | None:
        return _file_url(obj.name, self.context.get("request"))


class DhibanayaashaListSerializer(serializers.ModelSerializer):
    documents = DhibaneDocumentSerializer(
        many=True,
        read_only=True,
        source="dhibane_documents_set",
    )

    class Meta:
        model = Dhibanayaashas
        fields = ("id", "magaca", "dada_dh", "gender", "xalada", "phone", "fahfaahin", "documents")


class DhibanayaashaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dhibanayaashas
        fields = ("magaca", "dada_dh", "gender", "xalada", "phone", "fahfaahin")


class FaahfaahintaSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Faahfaahinta
        fields = ("id", "fahfaahin", "status", "recorded_by_name", "date_recorded", "updated_at")

    def get_recorded_by_name(self, obj) -> str | None:
        if not obj.recorded_by:
            return None
        return obj.recorded_by.get_full_name() or obj.recorded_by.username


class FaahfaahintaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Faahfaahinta
        fields = ("fahfaahin", "status")

    def validate_fahfaahin(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Fadlan qor faahfaahinta.")
        return value


class DhacdooyinkaListSerializer(serializers.ModelSerializer):
    gobolka_name = serializers.CharField(source="gobolka.name", read_only=True, default=None)
    degmada_name = serializers.CharField(source="degmada.name", read_only=True, default=None)
    waaxda_name = serializers.CharField(source="waaxda.name", read_only=True, default=None)
    laanta_name = serializers.CharField(source="laanta.name", read_only=True, default=None)
    nooca_dhacdada_name = serializers.CharField(source="nooca_dhacdada.type", read_only=True, default=None)
    location_display = serializers.SerializerMethodField()
    victim_count = serializers.SerializerMethodField()

    class Meta:
        model = Dhacdooyinka
        fields = (
            "id",
            "tixraac_lambar",
            "location_display",
            "gobolka_name",
            "degmada_name",
            "waaxda_name",
            "laanta_name",
            "cidda_fulisay",
            "nooca_dhacdada",
            "nooca_dhacdada_name",
            "dhimasho",
            "dhaawac",
            "victim_count",
            "khasaaraha_dhacdada",
            "taariikhda_dhacdada",
            "date_recorded",
            "year",
            "month",
        )

    def get_location_display(self, obj) -> str:
        parts = [
            obj.gobolka.name if obj.gobolka else None,
            obj.degmada.name if obj.degmada else None,
            obj.waaxda.name if obj.waaxda else None,
            obj.laanta.name if obj.laanta else None,
        ]
        return ", ".join(p for p in parts if p) or "—"

    def get_victim_count(self, obj) -> int:
        annotated = getattr(obj, "victim_count", None)
        if annotated is not None:
            return annotated
        return obj.dhibanayaashas_set.count()


def _first_faahfaahin(obj: Dhacdooyinka) -> str | None:
    text = (obj.tafaasiisha_goobta_dhacdada or "").strip()
    if text:
        return obj.tafaasiisha_goobta_dhacdada
    cached = getattr(obj, "_prefetched_objects_cache", None)
    updates = list(cached["faahfaahinta_set"]) if cached and "faahfaahinta_set" in cached else list(
        obj.faahfaahinta_set.all()
    )
    if not updates:
        return None
    first = min(
        updates,
        key=lambda u: (u.date_recorded or timezone.now(), u.id or 0),
    )
    return first.fahfaahin


class DhacdooyinkaDetailSerializer(DhacdooyinkaListSerializer):
    victims = DhibanayaashaListSerializer(many=True, read_only=True, source="dhibanayaashas_set")
    documents = DhacdoDocumentSerializer(many=True, read_only=True, source="dhacdodocuments_set")
    updates = FaahfaahintaSerializer(many=True, read_only=True, source="faahfaahinta_set")
    fahfaahin = serializers.SerializerMethodField()
    recorded_by_name = serializers.SerializerMethodField()
    upload_document_url = serializers.SerializerMethodField()
    target_location_display = serializers.SerializerMethodField()

    class Meta(DhacdooyinkaListSerializer.Meta):
        fields = DhacdooyinkaListSerializer.Meta.fields + (
            "gobolka",
            "degmada",
            "waaxda",
            "laanta",
            "bartilmaameedka_dhacdada",
            "target_location_display",
            "tafaasiisha_goobta_dhacdada",
            "fahfaahin",
            "tirada",
            "xuuraanshe",
            "xuuraan_bille",
            "latitude",
            "longitude",
            "dhacdada_status",
            "upload_document",
            "upload_document_url",
            "documents",
            "date_opp",
            "victims",
            "updates",
            "recorded_by_name",
        )

    def get_fahfaahin(self, obj) -> str | None:
        return _first_faahfaahin(obj)

    def get_recorded_by_name(self, obj) -> str | None:
        if not obj.recorded_by:
            return None
        return obj.recorded_by.get_full_name() or obj.recorded_by.username

    def get_upload_document_url(self, obj) -> str | None:
        return _file_url(obj.upload_document, self.context.get("request"))

    def get_target_location_display(self, obj) -> str:
        return target_location_name(obj) or ""

class DhacdooyinkaWriteSerializer(serializers.ModelSerializer):
    victims = DhibanayaashaWriteSerializer(many=True, required=False)

    class Meta:
        model = Dhacdooyinka
        fields = (
            "tixraac_lambar",
            "tafaasiisha_goobta_dhacdada",
            "taariikhda_dhacdada",
            "gobolka",
            "degmada",
            "waaxda",
            "laanta",
            "bartilmaameedka_dhacdada",
            "cidda_fulisay",
            "nooca_dhacdada",
            "khasaaraha_dhacdada",
            "tirada",
            "dhimasho",
            "dhaawac",
            "xuuraanshe",
            "xuuraan_bille",
            "latitude",
            "longitude",
            "upload_document",
            "date_opp",
            "victims",
        )

    def to_internal_value(self, data):
        mutable = data.copy() if hasattr(data, "copy") else dict(data)
        # Popped out and validated by hand: for multipart requests (i.e. whenever
        # any file is attached) request.data is a QueryDict, and DRF's nested
        # many=True field treats that as HTML form input — it reconstructs the
        # list from bracket-notation keys like victims[0]magaca instead of using
        # our parsed JSON string, silently dropping every victim. Bypassing the
        # declared `victims` field's own to_internal_value avoids that entirely.
        # .get() (not .pop()'s return value!) — QueryDict.pop() inherits from
        # dict.pop() and returns the raw internal value-list, not the unwrapped
        # single value .get()/__getitem__ would give.
        victims_raw = mutable.get("victims")
        mutable.pop("victims", None)
        if isinstance(victims_raw, str) and victims_raw.strip():
            victims_raw = json.loads(victims_raw)
        if not mutable.get("tafaasiisha_goobta_dhacdada") and mutable.get("fahfaahin"):
            mutable["tafaasiisha_goobta_dhacdada"] = mutable.get("fahfaahin")
        validated = super().to_internal_value(mutable)
        if victims_raw:
            victims_serializer = DhibanayaashaWriteSerializer(data=victims_raw, many=True)
            victims_serializer.is_valid(raise_exception=True)
            validated["victims"] = victims_serializer.validated_data
        return validated

    def _sync_description_log(self, dhacdo: Dhacdooyinka, recorded_by) -> None:
        text = (dhacdo.tafaasiisha_goobta_dhacdada or "").strip()
        if not text:
            return
        if dhacdo.faahfaahinta_set.exists():
            return
        Faahfaahinta.objects.create(
            dhacdo=dhacdo,
            fahfaahin=dhacdo.tafaasiisha_goobta_dhacdada,
            recorded_by=recorded_by,
            year=dhacdo.year,
            month=dhacdo.month,
        )

    def _victim_document_files(self) -> dict[int, list]:
        """{victim index: [uploaded files]} — a victim can have many documents;
        the frontend sends them all under the repeated key victim_document_{index}."""
        request = self.context.get("request")
        if request is None:
            return {}
        files: dict[int, list] = {}
        for key in request.FILES.keys():
            if not key.startswith("victim_document_"):
                continue
            try:
                index = int(key.removeprefix("victim_document_"))
            except ValueError:
                continue
            files[index] = request.FILES.getlist(key)
        return files

    def _save_victim_documents(self, victim: Dhibanayaashas, index: int, files: dict[int, list]) -> None:
        uploaded_files = files.get(index) or []
        if not uploaded_files:
            return
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        Dhibane_documents.objects.bulk_create(
            Dhibane_documents(dhibane=victim, user=user, document=uploaded) for uploaded in uploaded_files
        )

    def _event_evidence_files(self) -> list:
        """An event can have many evidence files, sent under the repeated key event_evidence."""
        request = self.context.get("request")
        if request is None:
            return []
        return request.FILES.getlist("event_evidence")

    def _save_event_evidence(self, dhacdo: Dhacdooyinka) -> None:
        uploaded_files = self._event_evidence_files()
        if not uploaded_files:
            return
        DhacdoDocuments.objects.bulk_create(
            DhacdoDocuments(dhacdo=dhacdo, name=uploaded) for uploaded in uploaded_files
        )

    def _create_victims(self, dhacdo: Dhacdooyinka, victims_data: list, recorded_by) -> None:
        files = self._victim_document_files()
        for index, victim in enumerate(victims_data):
            victim_obj = Dhibanayaashas.objects.create(
                dhacdo=dhacdo,
                recorded_by=recorded_by,
                year=dhacdo.year,
                month=dhacdo.month,
                **victim,
            )
            self._save_victim_documents(victim_obj, index, files)

    def _stamp_year_month(self, validated_data: dict) -> None:
        dt = validated_data.get("date_opp") or timezone.now().date()
        validated_data.setdefault("year", str(dt.year))
        validated_data.setdefault("month", str(dt.month).zfill(2))

    def create(self, validated_data):
        victims_data = validated_data.pop("victims", [])
        request = self.context.get("request")
        if not validated_data.get("tixraac_lambar"):
            validated_data["tixraac_lambar"] = generate_tixraac_lambar()
        if request and request.user.is_authenticated:
            validated_data.setdefault("recorded_by", request.user)
        self._stamp_year_month(validated_data)
        dhacdo = Dhacdooyinka.objects.create(**validated_data)
        self._create_victims(dhacdo, victims_data, validated_data.get("recorded_by"))
        self._save_event_evidence(dhacdo)
        self._sync_description_log(dhacdo, validated_data.get("recorded_by"))
        return dhacdo

    def update(self, instance, validated_data):
        victims_data = validated_data.pop("victims", None)
        self._stamp_year_month(validated_data)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if victims_data is not None:
            old_victims = instance.dhibanayaashas_set.all()
            # dhibane FK is on_delete=RESTRICT — clear their documents first or
            # the delete below raises once any victim has an uploaded document.
            Dhibane_documents.objects.filter(dhibane__in=old_victims).delete()
            old_victims.delete()
            self._create_victims(instance, victims_data, instance.recorded_by)
        # Additive: new evidence files supplement what's already attached,
        # they don't replace it (there's no "existing evidence" re-send from the form).
        self._save_event_evidence(instance)
        self._sync_description_log(instance, instance.recorded_by)
        return instance
