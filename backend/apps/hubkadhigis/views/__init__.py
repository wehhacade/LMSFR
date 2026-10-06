from apps.hubkadhigis.views.image import DisarmamentImageViewSet
from apps.hubkadhigis.views.lookup import (
    ForceUnitViewSet,
    RankViewSet,
    SurrenderLocationViewSet,
    WeaponTypeViewSet,
)
from apps.hubkadhigis.views.record import DisarmamentRecordViewSet

__all__ = [
    "RankViewSet",
    "ForceUnitViewSet",
    "WeaponTypeViewSet",
    "SurrenderLocationViewSet",
    "DisarmamentImageViewSet",
    "DisarmamentRecordViewSet",
]
