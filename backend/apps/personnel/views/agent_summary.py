"""Agent-level personnel summary for profile page."""

from django.db.models import Count
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Agent
from apps.accounts.permissions import IsActiveUser
from apps.personnel.models import (
    AgentAssignmentHistory,
    AgentAttendanceRecord,
    AgentRestriction,
    AgentStatusHistory,
)
from apps.personnel.permissions import AttendancePermission
from apps.personnel.scope import user_can_access_agent


class AgentPersonnelSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsActiveUser, AttendancePermission]

    def get(self, request, agent_id: int):
        agent = Agent.objects.select_related("county", "department", "agent_status").filter(pk=agent_id).first()
        if not agent:
            return Response({"detail": "Agent not found."}, status=404)
        if not user_can_access_agent(request.user, agent):
            return Response({"detail": "Agent is outside your organizational scope."}, status=403)

        attendance_qs = AgentAttendanceRecord.objects.filter(agent=agent).select_related("status", "absence_reason", "county")
        present = attendance_qs.filter(status__code="PRESENT").count()
        absent = attendance_qs.filter(status__code="ABSENT").count()
        total = attendance_qs.count()
        rate = round((present / total) * 100, 1) if total else 0

        recent_attendance = list(
            attendance_qs.order_by("-recorded_at")[:15].values(
                "id",
                "recorded_at",
                "status__name",
                "status__code",
                "absence_reason__name",
                "county__name",
                "notes",
            )
        )

        transfers = list(
            AgentAssignmentHistory.objects.filter(agent=agent)
            .select_related("from_county", "to_county", "performed_by")
            .order_by("-transfer_date")[:20]
            .values(
                "id",
                "transfer_date",
                "reason",
                "notes",
                "from_county__name",
                "to_county__name",
                "created_at",
            )
        )

        restrictions = list(
            AgentRestriction.objects.filter(agent=agent)
            .order_by("-start_date")[:10]
            .values(
                "id",
                "reason",
                "start_date",
                "end_date",
                "status",
                "id_card_status",
                "weapon_status",
                "notes",
            )
        )

        status_history = list(
            AgentStatusHistory.objects.filter(agent=agent)
            .select_related("old_status", "new_status")
            .order_by("-created_at")[:15]
            .values(
                "id",
                "created_at",
                "reason",
                "notes",
                "old_status__name",
                "new_status__name",
            )
        )

        return Response({
            "agent_id": agent.id,
            "service_id": agent.service_id,
            "service_id_last4": (agent.service_id or "")[-4:],
            "attendance": {
                "present_count": present,
                "absent_count": absent,
                "total_records": total,
                "attendance_rate": rate,
                "recent": recent_attendance,
            },
            "transfers": transfers,
            "restrictions": restrictions,
            "status_history": status_history,
        })
