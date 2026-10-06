from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Agent, Department
from apps.accounts.permissions import IsActiveUser
from apps.accounts.views.users import AccountsPagination
from apps.personnel.models import AgentAttendanceRecord, AgentRestriction
from apps.personnel.permissions import AttendancePermission
from apps.personnel.scope import scope_agents_queryset, scope_departments_queryset
from django.utils import timezone


class SectionManagementViewSet(viewsets.ViewSet):
    """Scoped section (qeybta) list with operational statistics."""

    permission_classes = [IsAuthenticated, IsActiveUser, AttendancePermission]
    pagination_class = AccountsPagination

    def _departments(self, request):
        qs = Department.objects.prefetch_related("counties").order_by("name")
        return scope_departments_queryset(qs, request.user)

    def list(self, request):
        today = timezone.now().date()
        agents_qs = scope_agents_queryset(Agent.objects.filter(is_archived=False), request.user)
        rows = []
        for dept in self._departments(request):
            county_ids = list(dept.counties.values_list("id", flat=True))
            dept_agents = agents_qs.filter(
                Q(department_id=dept.id) | Q(county_id__in=county_ids)
            ).distinct()
            total = dept_agents.count()
            active = dept_agents.filter(agent_status__code="ACTIVE").count()
            restricted = AgentRestriction.objects.filter(
                agent__in=dept_agents, status=AgentRestriction.Status.ACTIVE,
            ).count()
            present = AgentAttendanceRecord.objects.filter(
                session__date=today,
                status__code="PRESENT",
                agent__in=dept_agents,
            ).count()
            rows.append({
                "id": dept.id,
                "name": dept.name,
                "district_count": len(county_ids),
                "districts": [c.name for c in dept.counties.all()],
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
        dept = self._departments(request).filter(pk=pk).first()
        if not dept:
            return Response({"detail": "Not found."}, status=404)
        today = timezone.now().date()
        county_ids = list(dept.counties.values_list("id", flat=True))
        agents_qs = scope_agents_queryset(
            Agent.objects.filter(is_archived=False).filter(
                Q(department_id=dept.id) | Q(county_id__in=county_ids)
            ).select_related("agent_status", "county").distinct(),
            request.user,
        )
        district_breakdown = list(
            agents_qs.values("county__name").annotate(count=Count("id")).order_by("-count")
        )
        return Response({
            "id": dept.id,
            "name": dept.name,
            "districts": list(dept.counties.values("id", "name")),
            "total_agents": agents_qs.count(),
            "district_breakdown": district_breakdown,
            "present_today": AgentAttendanceRecord.objects.filter(
                session__date=today,
                status__code="PRESENT",
                agent__in=agents_qs,
            ).count(),
        })
