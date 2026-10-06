from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views.agents import AgentViewSet
from apps.accounts.views.users import (
    CountyViewSet,
    DepartmentViewSet,
    DirectorateViewSet,
    GroupViewSet,
    PermissionViewSet,
    RegionViewSet,
    RelationshipViewSet,
    SubCountyViewSet,
    UserTypeViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="account-user")
router.register("agents", AgentViewSet, basename="account-agent")
router.register("groups", GroupViewSet, basename="account-group")
router.register("permissions", PermissionViewSet, basename="account-permission")
router.register("types", UserTypeViewSet, basename="user-type")
router.register("directorates", DirectorateViewSet, basename="directorate")
router.register("departments", DepartmentViewSet, basename="department")
router.register("regions", RegionViewSet, basename="region")
router.register("counties", CountyViewSet, basename="county")
router.register("sub-counties", SubCountyViewSet, basename="sub-county")
router.register("relationships", RelationshipViewSet, basename="relationship")

urlpatterns = [
    path("accounts/", include(router.urls)),
]
