from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.audit.views import APITrafficViewSet, AuditStatsViewSet, AuditTrailViewSet, ErrorLogViewSet

router = DefaultRouter()
router.register("audit-trails", AuditTrailViewSet, basename="audit-trail")
router.register("error-logs", ErrorLogViewSet, basename="error-log")
router.register("api-traffic", APITrafficViewSet, basename="api-traffic")
router.register("audit-stats", AuditStatsViewSet, basename="audit-stats")

urlpatterns = [
    path("", include(router.urls)),
]
