from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Agent, County
from apps.accounts.permissions import IsActiveUser
from apps.accounts.views.users import AccountsPagination
from apps.personnel.models import AgentAttendanceRecord, AgentRestriction
from apps.personnel.permissions import AttendancePermission
from apps.personnel.scope import scope_agents_queryset, scope_counties_queryset
from django.utils import timezone


class DistrictManagementViewSet(viewsets.ViewSet):
    """Scoped district list with operational statistics."""

    permission_classes = [IsAuthenticated, IsActiveUser, AttendancePermission]
    pagination_class = AccountsPagination

    def _counties(self, request):
        return scope_counties_queryset(County.objects.select_related("region").order_by("name"), request.user)

    def list(self, request):
        today = timezone.now().date()
        agents_qs = scope_agents_queryset(Agent.objects.filter(is_archived=False), request.user)
        rows = []
        for county in self._counties(request):
            county_agents = agents_qs.filter(county=county)
            total = county_agents.count()
            active = county_agents.filter(agent_status__code="ACTIVE").count()
            restricted = AgentRestriction.objects.filter(
                agent__county=county, status=AgentRestriction.Status.ACTIVE,
            ).count()
            present = AgentAttendanceRecord.objects.filter(
                county=county, session__date=today, status__code="PRESENT",
            ).count()
            departments = list(county.departments.values_list("name", flat=True))
            rows.append({
                "id": county.id,
                "name": county.name,
                "region_name": county.region.name if county.region_id else "",
                "departments": departments,
                "total_agents": total,
                "active_agents": active,
                "restricted_agents": restricted,
                "present_today": present,
                "attendance_pct": round((present / total) * 100, 1) if total else 0,
            })
        paginator = AccountsPagination()
        page = paginator.paginate_queryset(rows, request)
        return paginator.get_paginated_response(page if page is not None else rows)

    def retrieve(self, request, pk=None):
        county = self._counties(request).filter(pk=pk).first()
        if not county:
            return Response({"detail": "Not found."}, status=404)
        today = timezone.now().date()
        agents_qs = scope_agents_queryset(
            Agent.objects.filter(county=county, is_archived=False).select_related("agent_status"),
            request.user,
        )
        status_breakdown = list(
            agents_qs.values("agent_status__name").annotate(count=Count("id")).order_by("-count")
        )
        recent_attendance = list(
            AgentAttendanceRecord.objects.filter(county=county)
            .select_related("agent", "status")
            .order_by("-recorded_at")[:20]
            .values("recorded_at", "agent__service_id", "agent__personal_fullname", "status__name")
        )
        return Response({
            "id": county.id,
            "name": county.name,
            "region_name": county.region.name if county.region_id else "",
            "departments": list(county.departments.values("id", "name")),
            "total_agents": agents_qs.count(),
            "status_breakdown": status_breakdown,
            "recent_attendance": recent_attendance,
            "present_today": AgentAttendanceRecord.objects.filter(
                county=county, session__date=today, status__code="PRESENT",
            ).count(),
        })
