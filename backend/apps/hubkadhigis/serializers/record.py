from rest_framework import serializers

from apps.hubkadhigis.models import DisarmamentRecord

from .image import DisarmamentImageSerializer
from .shared import RegisteredOfficerSerializer, absolute_file_url


class DisarmamentListSerializer(serializers.ModelSerializer):
    cover_image_url = serializers.SerializerMethodField()
    weapon_image_url = serializers.SerializerMethodField()
    person_image_url = serializers.SerializerMethodField()
    rank_name = serializers.CharField(source="rank.name", read_only=True, default=None)
    force_unit_name = serializers.CharField(source="force_unit.name", read_only=True, default=None)
    weapon_type_name = serializers.CharField(source="weapon_type.name", read_only=True, default=None)
    county_name = serializers.CharField(source="county.name", read_only=True, default=None)
    surrender_location_name = serializers.CharField(
        source="surrender_location.name", read_only=True, default=None
    )
    image_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = DisarmamentRecord
        fields = (
            "id",
            "reference_number",
            "person_name",
            "police_station",
            "phone_number",
            "force_unit",
            "force_unit_name",
            "force_number",
            "rank",
            "rank_name",
            "weapon_type",
            "weapon_type_name",
            "weapon_serial",
            "county",
            "county_name",
            "surrender_location",
            "surrender_location_name",
            "surrender_date",
            "cover_image_url",
            "weapon_image_url",
            "person_image_url",
            "year",
            "month",
            "created_at",
            "image_count",
        )

    def get_cover_image_url(self, obj) -> str | None:
        return absolute_file_url(obj.cover_image, self.context.get("request"))

    def get_weapon_image_url(self, obj) -> str | None:
        return absolute_file_url(obj.cover_image, self.context.get("request"))

    def get_person_image_url(self, obj) -> str | None:
        return absolute_file_url(obj.person_image, self.context.get("request"))


class DisarmamentDetailSerializer(DisarmamentListSerializer):
    registered_officer = RegisteredOfficerSerializer(source="created_by", read_only=True, allow_null=True)
    images = DisarmamentImageSerializer(many=True, read_only=True)
    updated_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)

    class Meta(DisarmamentListSerializer.Meta):
        fields = DisarmamentListSerializer.Meta.fields + (
            "details",
            "latitude",
            "longitude",
            "updated_at",
            "registered_officer",
            "images",
        )


class DisarmamentWriteSerializer(serializers.ModelSerializer):
    cover_image = serializers.FileField(required=False, allow_null=True)
    person_image = serializers.FileField(required=False, allow_null=True)
    repeat_from = serializers.IntegerField(required=False, write_only=True, allow_null=True)

    class Meta:
        model = DisarmamentRecord
        fields = (
            "id",
            "reference_number",
            "person_name",
            "police_station",
            "phone_number",
            "force_unit",
            "force_number",
            "details",
            "rank",
            "weapon_type",
            "weapon_serial",
            "county",
            "surrender_location",
            "surrender_date",
            "cover_image",
            "person_image",
            "latitude",
            "longitude",
            "year",
            "month",
            "repeat_from",
        )
        read_only_fields = ("id", "reference_number")

    def _apply_repeat_from(self, validated_data, repeat_from_id):
        if not repeat_from_id:
            return validated_data
        try:
            source = DisarmamentRecord.objects.get(pk=repeat_from_id)
        except DisarmamentRecord.DoesNotExist:
            return validated_data

        for field in (
            "person_name",
            "phone_number",
            "police_station",
            "force_unit",
            "rank",
            "force_number",
            "county",
        ):
            if not validated_data.get(field) and getattr(source, field):
                validated_data[field] = getattr(source, field)

        if not validated_data.get("person_image") and source.person_image:
            validated_data["person_image"] = source.person_image

        return validated_data

    def create(self, validated_data):
        repeat_from_id = validated_data.pop("repeat_from", None)
        validated_data = self._apply_repeat_from(validated_data, repeat_from_id)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)
