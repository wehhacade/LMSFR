from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.personnel.views import (
    AttendanceRecordViewSet,
    AttendanceSessionViewSet,
    DashboardViewSet,
    ImportViewSet,
    ReferenceViewSet,
    RestrictionViewSet,
    StatusHistoryViewSet,
    TransferViewSet,
)
from apps.personnel.views.agent_summary import AgentPersonnelSummaryView
from apps.personnel.views.districts import DistrictManagementViewSet
from apps.personnel.views.reports import ReportViewSet
from apps.personnel.views.sections import SectionManagementViewSet

router = DefaultRouter()
router.register("reference", ReferenceViewSet, basename="personnel-reference")
router.register("transfers", TransferViewSet, basename="personnel-transfer")
router.register("status-history", StatusHistoryViewSet, basename="personnel-status-history")
router.register("attendance/sessions", AttendanceSessionViewSet, basename="personnel-attendance-session")
router.register("attendance/records", AttendanceRecordViewSet, basename="personnel-attendance-record")
router.register("restrictions", RestrictionViewSet, basename="personnel-restriction")
router.register("import", ImportViewSet, basename="personnel-import")
router.register("reports", ReportViewSet, basename="personnel-reports")
router.register("districts", DistrictManagementViewSet, basename="personnel-districts")
router.register("sections", SectionManagementViewSet, basename="personnel-sections")
router.register("dashboard", DashboardViewSet, basename="personnel-dashboard")

urlpatterns = [
    path("personnel/agents/<int:agent_id>/summary/", AgentPersonnelSummaryView.as_view(), name="personnel-agent-summary"),
    path("personnel/", include(router.urls)),
]
