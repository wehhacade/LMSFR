from rest_framework import serializers

from apps.hubkadhigis.models import ForceUnit, Rank, SurrenderLocation, WeaponType


class LookupSerializer(serializers.ModelSerializer):
    class Meta:
        fields = ("id", "name")


class RankSerializer(LookupSerializer):
    class Meta(LookupSerializer.Meta):
        model = Rank


class ForceUnitSerializer(LookupSerializer):
    class Meta(LookupSerializer.Meta):
        model = ForceUnit


class WeaponTypeSerializer(LookupSerializer):
    class Meta(LookupSerializer.Meta):
        model = WeaponType


class SurrenderLocationSerializer(LookupSerializer):
    class Meta(LookupSerializer.Meta):
        model = SurrenderLocation
