from rest_framework import serializers

from apps.hubkadhigis.models import DisarmamentImage

from .shared import absolute_file_url


class DisarmamentImageSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file = serializers.FileField(write_only=True, required=False)
    record_reference = serializers.CharField(
        source="record.reference_number", read_only=True, default=None
    )
    record_person_name = serializers.CharField(
        source="record.person_name", read_only=True, default=None
    )
    weapon_type_name = serializers.CharField(source="weapon_type.name", read_only=True, default=None)
    county_name = serializers.CharField(source="county.name", read_only=True, default=None)
    surrender_location_name = serializers.CharField(
        source="surrender_location.name", read_only=True, default=None
    )
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DisarmamentImage
        fields = (
            "id",
            "record",
            "record_reference",
            "record_person_name",
            "file",
            "file_url",
            "image_type",
            "caption",
            "weapon_type",
            "weapon_type_name",
            "weapon_serial",
            "county",
            "county_name",
            "surrender_location",
            "surrender_location_name",
            "surrender_date",
            "uploaded_by",
            "uploaded_by_name",
            "created_at",
        )
        read_only_fields = ("id", "uploaded_by", "created_at")

    def get_file_url(self, obj) -> str | None:
        return absolute_file_url(obj.file, self.context.get("request"))

    def get_uploaded_by_name(self, obj) -> str | None:
        if not obj.uploaded_by:
            return None
        return obj.uploaded_by.get_full_name() or obj.uploaded_by.email

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["uploaded_by"] = request.user
        return super().create(validated_data)
