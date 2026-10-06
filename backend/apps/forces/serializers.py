from rest_framework import serializers

from .models import Force


class ForceListSerializer(serializers.ModelSerializer):
    photo = serializers.URLField(source="photo_url")

    class Meta:
        model = Force
        fields = (
            "id", "name", "badge_number", "photo",
            "rank", "unit", "district", "status", "phone",
        )


class ForceDetailSerializer(ForceListSerializer):
    joined_date = serializers.DateField(format="%Y-%m-%d")
    created_at  = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ")
    updated_at  = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ")

    class Meta(ForceListSerializer.Meta):
        fields = ForceListSerializer.Meta.fields + (
            "joined_date", "notes", "created_at", "updated_at",
        )
