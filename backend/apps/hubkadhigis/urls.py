from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.hubkadhigis.views import (
    DisarmamentImageViewSet,
    DisarmamentRecordViewSet,
    ForceUnitViewSet,
    RankViewSet,
    SurrenderLocationViewSet,
    WeaponTypeViewSet,
)

router = DefaultRouter()
router.register("ranks", RankViewSet, basename="disarmament-rank")
router.register("force-units", ForceUnitViewSet, basename="disarmament-force-unit")
router.register("weapon-types", WeaponTypeViewSet, basename="disarmament-weapon-type")
router.register("surrender-locations", SurrenderLocationViewSet, basename="disarmament-surrender-location")
router.register("images", DisarmamentImageViewSet, basename="disarmament-image")
router.register("", DisarmamentRecordViewSet, basename="disarmament-record")

urlpatterns = [
    path("", include(router.urls)),
]
