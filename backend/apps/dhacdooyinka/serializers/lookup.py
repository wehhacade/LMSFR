from rest_framework import serializers

from apps.dhacdooyinka.models import NoocaDhacdooyinkaGuud, NoocaDhaxdooyinka


class NoocaDhacdooyinkaGuudSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoocaDhacdooyinkaGuud
        fields = ("id", "name", "created_at", "update_at")
        read_only_fields = ("id", "created_at", "update_at")


class NoocaDhaxdooyinkaSerializer(serializers.ModelSerializer):
    utility_name = serializers.CharField(
        source="nooca_dhacdooyinka_guud.name",
        read_only=True,
        default=None,
    )

    class Meta:
        model = NoocaDhaxdooyinka
        fields = (
            "id",
            "type",
            "nooca_dhacdooyinka_guud",
            "utility_name",
            "date_recorded",
            "created_at",
            "update_at",
        )
        read_only_fields = ("id", "date_recorded", "created_at", "update_at")
