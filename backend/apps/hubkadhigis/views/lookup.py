from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsActiveUser
from apps.hubkadhigis.models import ForceUnit, Rank, SurrenderLocation, WeaponType
from apps.hubkadhigis.permissions import DisarmamentPermission
from apps.hubkadhigis.serializers.lookup import (
    ForceUnitSerializer,
    RankSerializer,
    SurrenderLocationSerializer,
    WeaponTypeSerializer,
)


class LookupViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, DisarmamentPermission]
    pagination_class = None


class RankViewSet(LookupViewSet):
    queryset = Rank.objects.all()
    serializer_class = RankSerializer


class ForceUnitViewSet(LookupViewSet):
    queryset = ForceUnit.objects.all()
    serializer_class = ForceUnitSerializer


class WeaponTypeViewSet(LookupViewSet):
    queryset = WeaponType.objects.all()
    serializer_class = WeaponTypeSerializer


class SurrenderLocationViewSet(LookupViewSet):
    queryset = SurrenderLocation.objects.all()
    serializer_class = SurrenderLocationSerializer
