from rest_framework import serializers

from apps.suspects.photo_utils import resolve_photo_url


class RegisteredOfficerSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    full_name = serializers.SerializerMethodField()
    email = serializers.EmailField(read_only=True)

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.email


def absolute_file_url(file_field, request) -> str | None:
    if not file_field or not getattr(file_field, "name", None):
        return None
    return resolve_photo_url(file_field.name, request) or None
