from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.amniga.permissions import AmnigaModulePermission
from apps.amniga.services.queries import (
    amniga_analytics,
    amniga_daily_report,
    amniga_district_profile,
    amniga_stats,
    can_view_agents,
    can_view_reports,
)
from apps.amniga.services.reports import (
    district_work_report,
    user_track_map_report,
    user_activity_report,
)
from apps.core.cache import MEDIUM, SHORT, cache_response


def _int_param(request, name: str, default: int) -> int:
    try:
        return int(request.query_params.get(name, default))
    except (TypeError, ValueError):
        return default


class AmnigaDashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, AmnigaModulePermission]

    @cache_response(timeout=MEDIUM, key_prefix="amniga.stats.v3")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        return Response(amniga_stats(request.user))

    @cache_response(timeout=MEDIUM, key_prefix="amniga.analytics.v4")
    @action(detail=False, methods=["get"])
    def analytics(self, request):
        range_str = request.query_params.get("range", "7d")
        return Response(amniga_analytics(request.user, range_str=range_str))

    @cache_response(timeout=SHORT, key_prefix="amniga.daily_report")
    @action(detail=False, methods=["get"], url_path="daily-report")
    def daily_report(self, request):
        if not can_view_reports(request.user):
            return Response(
                {"detail": "You do not have permission to view the daily suspect report."},
                status=status.HTTP_403_FORBIDDEN,
            )
        date_str = request.query_params.get("date") or None
        date_from = request.query_params.get("date_from") or None
        date_to = request.query_params.get("date_to") or None
        district = request.query_params.get("district", "")
        return Response(
            amniga_daily_report(
                request.user,
                date_str=date_str,
                date_from=date_from,
                date_to=date_to,
                district=district,
            )
        )

    @cache_response(timeout=SHORT, key_prefix="amniga.district_profile")
    @action(detail=False, methods=["get"], url_path="daily-report/district-profile")
    def district_profile(self, request):
        # Used from both Daily Report (view_daily_report) and Shaqada Degmooyinka
        # (view_agent). Align with the list the user already opened.
        if not (can_view_reports(request.user) or can_view_agents(request.user)):
            return Response(
                {"detail": "You do not have permission to view the district profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        district = (request.query_params.get("district") or "").strip()
        if not district:
            return Response(
                {"detail": "District is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = amniga_district_profile(
            request.user,
            district=district,
            date_str=request.query_params.get("date") or None,
            date_from=request.query_params.get("date_from") or None,
            date_to=request.query_params.get("date_to") or None,
        )
        if data is None:
            return Response(
                {"detail": "District not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(data)

    @cache_response(timeout=SHORT, key_prefix="amniga.user_reports")
    @action(detail=False, methods=["get"], url_path="user-reports")
    def user_reports(self, request):
        """Warbixinta Isticmaalayaasha."""
        if not can_view_agents(request.user):
            return Response(
                {"detail": "You do not have permission to view user reports."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(user_activity_report(
            search=request.query_params.get("search", "").strip(),
            county=request.query_params.get("county", "").strip(),
            page=_int_param(request, "page", 1),
            page_size=_int_param(request, "page_size", 10),
            active_only=request.query_params.get("active_only", "").lower() in ("1", "true"),
            top_users=request.query_params.get("top_users", "").lower() in ("1", "true"),
        ))

    @cache_response(timeout=SHORT, key_prefix="amniga.district_tasks")
    @action(detail=False, methods=["get"], url_path="district-tasks")
    def district_tasks(self, request):
        """Shaqada Degmooyinka."""
        if not can_view_agents(request.user):
            return Response(
                {"detail": "You do not have permission to view district tasks."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(district_work_report(
            search=request.query_params.get("search", "").strip(),
            page=_int_param(request, "page", 1),
            page_size=_int_param(request, "page_size", 10),
            date_from=request.query_params.get("date_from") or None,
            date_to=request.query_params.get("date_to") or None,
        ))

    @cache_response(timeout=SHORT, key_prefix="amniga.user_track_map")
    @action(detail=False, methods=["get"], url_path="user-track-map")
    def user_track_map(self, request):
        """GPS track map (separate tracking section)."""
        if not can_view_agents(request.user):
            return Response(
                {"detail": "You do not have permission to view user track map."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(
            user_track_map_report(
                user_id=request.query_params.get("user_id"),
                hours=_int_param(request, "hours", 0),
                viewer=request.user,
                search=request.query_params.get("search", "").strip() or None,
            )
        )
