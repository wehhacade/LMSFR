from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Agent, County
from apps.accounts.permissions import IsActiveUser
from apps.accounts.views.users import AccountsPagination
from apps.audit.mixins import AuditedViewSetMixin
from apps.audit.models import AuditTrail
from apps.personnel.models import (
    AbsenceReason,
    AgentAttendanceRecord,
    AgentAttendanceSession,
    AgentRestriction,
    AgentStatus,
    AttendanceStatus,
)
from apps.personnel.permissions import AttendancePermission, ImportPermission, RestrictionPermission, TransferPermission
from apps.personnel.scope import (
    scope_agent_related_queryset,
    scope_agents_queryset,
    scope_assignment_history_queryset,
    scope_counties_queryset,
    user_can_access_county,
)
from apps.personnel.services.agent_presenters import agent_county_name, agent_report_name
from apps.personnel.services.reports import restriction_alerts
from apps.personnel.services.import_service import get_section_agents
from apps.personnel.serializers import (
    AbsenceReasonSerializer,
    AgentAttendanceRecordSerializer,
    AgentAttendanceSessionSerializer,
    AgentRestrictionCreateSerializer,
    AgentRestrictionExtendSerializer,
    AgentRestrictionSerializer,
    AgentStatusSerializer,
    AgentTransferCreateSerializer,
    AttendanceBulkRecordSerializer,
    AttendanceSectionOpenSerializer,
    AttendanceSessionOpenSerializer,
    AttendanceStatusSerializer,
)
from apps.personnel.services.operations import (
    create_restriction,
    extend_restriction,
    get_or_create_attendance_status,
    release_restriction,
    transfer_agent,
)
from apps.personnel.services.import_service import ImportParseError, import_agent_roster
from apps.personnel.services.merge_service import AgentMergeError, merge_agents
from apps.personnel.serializers.transfer import AgentAssignmentHistorySerializer
from apps.personnel.models import AgentAssignmentHistory, AgentStatusHistory
from apps.personnel.serializers.transfer import AgentStatusHistorySerializer
from apps.personnel.serializers.import_batch import AgentImportBatchSerializer
from apps.personnel.models import AgentImportBatch


class ReferenceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser]
    pagination_class = None

    @action(detail=False, methods=["get"], url_path="agent-statuses")
    def agent_statuses(self, request):
        qs = AgentStatus.objects.all()
        return Response(AgentStatusSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="attendance-statuses")
    def attendance_statuses(self, request):
        qs = AttendanceStatus.objects.all()
        return Response(AttendanceStatusSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="absence-reasons")
    def absence_reasons(self, request):
        qs = AbsenceReason.objects.all()
        return Response(AbsenceReasonSerializer(qs, many=True).data)


class TransferViewSet(AuditedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    audit_module = "personnel"
    audit_entity = "transfer"
    permission_classes = [IsAuthenticated, IsActiveUser, TransferPermission]
    serializer_class = AgentAssignmentHistorySerializer
    pagination_class = AccountsPagination

    def get_queryset(self):
        qs = AgentAssignmentHistory.objects.select_related(
            "agent", "from_county", "to_county", "from_department", "to_department", "performed_by",
        ).order_by("-transfer_date", "-created_at")
        county_ids = self.request.query_params.get("county")
        if county_ids:
            qs = qs.filter(Q(from_county_id=county_ids) | Q(to_county_id=county_ids))
        agent_id = self.request.query_params.get("agent")
        if agent_id:
            qs = qs.filter(agent_id=agent_id)
        return scope_assignment_history_queryset(qs, self.request.user)

    @action(detail=False, methods=["post"])
    def transfer(self, request):
        ser = AgentTransferCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        from apps.accounts.models import Agent, County, Department

        agent = Agent.objects.filter(pk=data["agent_id"]).first()
        if not agent:
            return Response({"detail": "Agent not found."}, status=status.HTTP_404_NOT_FOUND)
        to_county = County.objects.filter(pk=data["to_county_id"]).first()
        if not to_county:
            return Response({"detail": "County not found."}, status=status.HTTP_404_NOT_FOUND)
        to_department = None
        if data.get("to_department_id"):
            to_department = Department.objects.filter(pk=data["to_department_id"]).first()

        try:
            history = transfer_agent(
                agent=agent,
                to_county=to_county,
                to_department=to_department,
                reason=data["reason"],
                transfer_date=data["transfer_date"],
                performed_by=request.user,
                notes=data.get("notes", ""),
            )
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Transferred agent {agent.service_id} to {to_county.name}",
            entity_id=agent.pk,
        )
        return Response(AgentAssignmentHistorySerializer(history).data, status=status.HTTP_201_CREATED)


class StatusHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, TransferPermission]
    serializer_class = AgentStatusHistorySerializer
    pagination_class = AccountsPagination

    def get_queryset(self):
        qs = AgentStatusHistory.objects.select_related("agent", "old_status", "new_status", "changed_by")
        agent_id = self.request.query_params.get("agent")
        if agent_id:
            qs = qs.filter(agent_id=agent_id)
        return scope_agent_related_queryset(qs, self.request.user).order_by("-created_at")


def _attendance_agent_rows(session, agents_qs, existing: dict) -> list[dict]:
    rows = []
    for agent in agents_qs:
        rec = existing.get(agent.id)
        sid = agent.service_id or ""
        rows.append({
            "agent_id": agent.id,
            "session_id": session.id,
            "county_id": agent.county_id,
            "county_name": agent_county_name(agent),
            "service_id": sid,
            "service_id_last4": sid[-4:] if len(sid) >= 4 else sid,
            "name": agent_report_name(agent),
            "phone": agent.phone,
            "status_name": agent.agent_status.name if getattr(agent, "agent_status_id", None) else agent.status,
            "attendance": AgentAttendanceRecordSerializer(rec).data if rec else None,
        })
    return rows


class AttendanceSessionViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    audit_module = "personnel"
    audit_entity = "attendance_session"
    permission_classes = [IsAuthenticated, IsActiveUser, AttendancePermission]
    serializer_class = AgentAttendanceSessionSerializer
    pagination_class = AccountsPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = AgentAttendanceSession.objects.select_related("county", "department", "opened_by").annotate(
            record_count=Count("records"),
        ).order_by("-date", "-created_at")
        county = self.request.query_params.get("county")
        if county:
            qs = qs.filter(county_id=county)
        date = self.request.query_params.get("date")
        if date:
            qs = qs.filter(date=date)
        county_ids = scope_counties_queryset(County.objects.all(), self.request.user).values_list("id", flat=True)
        return qs.filter(county_id__in=county_ids)

    def create(self, request, *args, **kwargs):
        ser = AttendanceSessionOpenSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if not user_can_access_county(request.user, data["county_id"]):
            return Response({"detail": "County is outside your scope."}, status=status.HTTP_403_FORBIDDEN)

        from apps.accounts.models import Department

        session, created = AgentAttendanceSession.objects.get_or_create(
            county_id=data["county_id"],
            date=data["date"],
            session=data["session"],
            defaults={
                "department_id": data.get("department_id"),
                "opened_by": request.user,
                "notes": data.get("notes", ""),
            },
        )
        if not created:
            return Response(AgentAttendanceSessionSerializer(session).data)
        self._audit_log(
            AuditTrail.EventType.CREATE,
            f"Opened attendance session for {session.county.name} on {session.date}",
            entity_id=session.pk,
        )
        return Response(AgentAttendanceSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="open-section")
    def open_section(self, request):
        from apps.accounts.models import Department

        ser = AttendanceSectionOpenSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        department = Department.objects.filter(pk=data["department_id"]).prefetch_related("counties").first()
        if not department:
            return Response({"detail": "Section not found."}, status=status.HTTP_404_NOT_FOUND)

        section_county_ids = list(department.counties.values_list("id", flat=True))
        if not section_county_ids:
            return Response({"detail": "This section has no linked districts."}, status=status.HTTP_400_BAD_REQUEST)

        county_id = data.get("county_id")
        if county_id:
            if not user_can_access_county(request.user, county_id):
                return Response({"detail": "District is outside your scope."}, status=status.HTTP_403_FORBIDDEN)
            if county_id not in section_county_ids:
                return Response({"detail": "District is not linked to this section."}, status=status.HTTP_400_BAD_REQUEST)
            target_county_ids = [county_id]
            scope = "district"
        else:
            target_county_ids = [
                cid for cid in section_county_ids
                if user_can_access_county(request.user, cid)
            ]
            if not target_county_ids:
                return Response({"detail": "No districts in this section are within your scope."}, status=status.HTTP_403_FORBIDDEN)
            scope = "section"

        sessions = []
        all_agents: list[dict] = []
        section_agents = scope_agents_queryset(
            get_section_agents(department).select_related("county", "agent_status"),
            request.user,
        )

        for cid in target_county_ids:
            session, created = AgentAttendanceSession.objects.get_or_create(
                county_id=cid,
                date=data["date"],
                session=data["session"],
                defaults={
                    "department_id": department.id,
                    "opened_by": request.user,
                    "notes": data.get("notes", ""),
                },
            )
            if not created and not session.department_id:
                session.department_id = department.id
                session.save(update_fields=["department"])
            sessions.append(session)
            existing = {
                r.agent_id: r
                for r in AgentAttendanceRecord.objects.filter(session=session).select_related("status", "absence_reason")
            }
            county_agents = section_agents.filter(county_id=cid).order_by("service_id")
            all_agents.extend(_attendance_agent_rows(session, county_agents, existing))

        self._audit_log(
            AuditTrail.EventType.CREATE,
            f"Opened {scope} attendance for {department.name} on {data['date']} ({len(sessions)} district session(s))",
            details={"department_id": department.id, "scope": scope, "session_ids": [s.pk for s in sessions]},
        )
        return Response({
            "department_id": department.id,
            "department_name": department.name,
            "scope": scope,
            "date": data["date"],
            "session": data["session"],
            "sessions": AgentAttendanceSessionSerializer(sessions, many=True).data,
            "agents": all_agents,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="agents")
    def agents(self, request, pk=None):
        session = self.get_object()
        agents_qs = scope_agents_queryset(
            Agent.objects.filter(county_id=session.county_id).select_related("county", "agent_status"),
            request.user,
        ).order_by("service_id")
        if session.department_id:
            section_agents = get_section_agents(session.department)
            agents_qs = scope_agents_queryset(
                section_agents.filter(county_id=session.county_id).select_related("county", "agent_status"),
                request.user,
            ).order_by("service_id")
        search = request.query_params.get("search", "").strip()
        if search:
            agents_qs = agents_qs.filter(
                Q(service_id__icontains=search)
                | Q(personal_fullname__icontains=search)
                | Q(first_name__icontains=search)
                | Q(father_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(phone__icontains=search)
            )
        existing = {
            r.agent_id: r
            for r in AgentAttendanceRecord.objects.filter(session=session).select_related("status", "absence_reason")
        }
        rows = _attendance_agent_rows(session, agents_qs, existing)
        return Response({"session": AgentAttendanceSessionSerializer(session).data, "agents": rows})

    @action(detail=True, methods=["post"], url_path="bulk-record")
    def bulk_record(self, request, pk=None):
        session = self.get_object()
        records_data = request.data.get("records", [])
        if not isinstance(records_data, list):
            return Response({"detail": "records must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        saved = []
        for item in records_data:
            ser = AttendanceBulkRecordSerializer(data=item)
            ser.is_valid(raise_exception=True)
            data = ser.validated_data
            agent = Agent.objects.filter(pk=data["agent_id"], county_id=session.county_id).first()
            if not agent:
                continue
            status_obj = get_or_create_attendance_status(data["status_code"])
            absence_reason = None
            if data.get("absence_reason_code"):
                absence_reason = AbsenceReason.objects.filter(code=data["absence_reason_code"]).first()
            if status_obj.requires_reason and not absence_reason and not data.get("notes"):
                return Response(
                    {"detail": f"Absence reason required for agent {agent.service_id}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            record, _ = AgentAttendanceRecord.objects.update_or_create(
                session=session,
                agent=agent,
                defaults={
                    "county": session.county,
                    "department": session.department,
                    "status": status_obj,
                    "absence_reason": absence_reason,
                    "notes": data.get("notes", ""),
                    "recorded_by": request.user,
                },
            )
            saved.append(record)
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Recorded attendance for {len(saved)} agent(s) in session {session.pk}",
            entity_id=session.pk,
            details={"record_count": len(saved)},
        )
        return Response(AgentAttendanceRecordSerializer(saved, many=True).data)


class AttendanceRecordViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, AttendancePermission]
    serializer_class = AgentAttendanceRecordSerializer
    pagination_class = AccountsPagination

    def get_queryset(self):
        qs = AgentAttendanceRecord.objects.select_related(
            "agent", "session", "county", "department", "status", "absence_reason",
        ).order_by("-recorded_at")
        agent = self.request.query_params.get("agent")
        if agent:
            qs = qs.filter(agent_id=agent)
        county = self.request.query_params.get("county")
        if county:
            qs = qs.filter(county_id=county)
        return scope_agent_related_queryset(qs, self.request.user)


class RestrictionViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    audit_module = "personnel"
    audit_entity = "restriction"
    permission_classes = [IsAuthenticated, IsActiveUser, RestrictionPermission]
    serializer_class = AgentRestrictionSerializer
    pagination_class = AccountsPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = AgentRestriction.objects.select_related("agent", "created_by", "released_by").order_by("-start_date")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        agent = self.request.query_params.get("agent")
        if agent:
            qs = qs.filter(agent_id=agent)
        return scope_agent_related_queryset(qs, self.request.user)

    def create(self, request, *args, **kwargs):
        ser = AgentRestrictionCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        from apps.accounts.models import Agent

        agent = Agent.objects.filter(pk=data["agent_id"]).first()
        if not agent:
            return Response({"detail": "Agent not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            restriction = create_restriction(
                agent=agent,
                reason=data["reason"],
                start_date=data["start_date"],
                end_date=data["end_date"],
                id_card_withheld=data["id_card_withheld"],
                weapon_withheld=data["weapon_withheld"],
                notes=data.get("notes", ""),
                created_by=request.user,
            )
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        self._audit_log(
            AuditTrail.EventType.CREATE,
            f"Created restriction for agent {agent.service_id}",
            entity_id=restriction.pk,
        )
        return Response(AgentRestrictionSerializer(restriction).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def release(self, request, pk=None):
        restriction = self.get_object()
        try:
            restriction = release_restriction(
                restriction=restriction,
                performed_by=request.user,
                notes=request.data.get("notes", ""),
            )
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Released restriction for agent {restriction.agent.service_id}",
            entity_id=restriction.pk,
        )
        return Response(AgentRestrictionSerializer(restriction).data)

    @action(detail=True, methods=["post"])
    def extend(self, request, pk=None):
        restriction = self.get_object()
        ser = AgentRestrictionExtendSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            restriction = extend_restriction(
                restriction=restriction,
                new_end_date=ser.validated_data["new_end_date"],
                new_reason=ser.validated_data.get("new_reason", ""),
                performed_by=request.user,
                notes=ser.validated_data.get("notes", ""),
            )
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Extended restriction for agent {restriction.agent.service_id}",
            entity_id=restriction.pk,
        )
        return Response(AgentRestrictionSerializer(restriction).data)

    @action(detail=False, methods=["get"], url_path="expiring")
    def expiring(self, request):
        today = timezone.now().date()
        qs = self.get_queryset().filter(status=AgentRestriction.Status.ACTIVE, end_date__lte=today)
        week = today + timezone.timedelta(days=7)
        return Response({
            "expired": qs.filter(end_date__lt=today).count(),
            "expiring_today": qs.filter(end_date=today).count(),
            "expiring_within_7_days": self.get_queryset().filter(
                status=AgentRestriction.Status.ACTIVE,
                end_date__gt=today,
                end_date__lte=week,
            ).count(),
        })


class ImportViewSet(AuditedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    audit_module = "personnel"
    audit_entity = "import"
    permission_classes = [IsAuthenticated, IsActiveUser, ImportPermission]
    serializer_class = AgentImportBatchSerializer
    pagination_class = AccountsPagination
    queryset = AgentImportBatch.objects.select_related("uploaded_by").order_by("-created_at")

    @action(detail=False, methods=["post"], url_path="upload", parser_classes=[MultiPartParser])
    def upload(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
        dry_run = str(request.data.get("dry_run", "true")).strip().lower() != "false"
        department_scope = str(request.data.get("department_scope", "")).strip()
        try:
            summary = import_agent_roster(
                upload,
                user=request.user,
                filename=upload.name or "",
                dry_run=dry_run,
                department_scope=department_scope,
            )
        except ImportParseError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            from django.db import IntegrityError

            if isinstance(exc, IntegrityError):
                return Response(
                    {
                        "detail": (
                            "Import blocked by a database constraint (often duplicate phone numbers). "
                            "Re-preview the file, resolve CONFLICT rows with Merge, then apply again."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            raise
        event = AuditTrail.EventType.VIEW if dry_run else AuditTrail.EventType.CREATE
        self._audit_log(
            event,
            f"{'Previewed' if dry_run else 'Applied'} agent import ({upload.name})",
            details={"dry_run": dry_run, "total_rows": summary.get("total_rows", 0)},
        )
        return Response(summary)

    @action(detail=False, methods=["post"], url_path="merge-conflict")
    def merge_conflict(self, request):
        agent_ids = request.data.get("agent_ids") or []
        if not isinstance(agent_ids, list):
            return Response({"detail": "agent_ids must be a list."}, status=status.HTTP_400_BAD_REQUEST)
        excel_service_id = str(request.data.get("excel_service_id") or "").strip()
        preferred_phone = str(request.data.get("preferred_phone") or "").strip()
        try:
            result = merge_agents(
                agent_ids=agent_ids,
                excel_service_id=excel_service_id,
                preferred_phone=preferred_phone,
                performed_by=request.user,
            )
        except AgentMergeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Merged import conflict agents into pk {result['primary_agent']['id']}",
            details={"merged_agent_ids": result["merged_agent_ids"], "excel_service_id": excel_service_id},
        )
        return Response(result)


class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, AttendancePermission]

    def list(self, request):
        today = timezone.now().date()
        counties = scope_counties_queryset(County.objects.all(), request.user)
        agents_qs = scope_agents_queryset(Agent.objects.select_related("agent_status", "county"), request.user)
        total_agents = agents_qs.count()

        sessions_today = AgentAttendanceSession.objects.filter(date=today, county__in=counties)
        records_today = AgentAttendanceRecord.objects.filter(session__in=sessions_today)

        present = records_today.filter(status__code="PRESENT").count()
        absent = records_today.filter(status__code="ABSENT").count()
        excused = records_today.filter(status__code="EXCUSED").count()

        status_counts = {}
        for row in agents_qs.values("agent_status__code").annotate(c=Count("id")):
            code = row["agent_status__code"] or "UNKNOWN"
            status_counts[code] = row["c"]

        district_stats = []
        for county in counties:
            county_agents = agents_qs.filter(county=county).count()
            county_present = records_today.filter(county=county, status__code="PRESENT").count()
            district_stats.append({
                "county_id": county.id,
                "county_name": county.name,
                "total_agents": county_agents,
                "present_today": county_present,
                "attendance_pct": round((county_present / county_agents) * 100, 1) if county_agents else 0,
            })

        restrictions = AgentRestriction.objects.filter(status=AgentRestriction.Status.ACTIVE)
        restrictions = scope_agent_related_queryset(restrictions, request.user)
        alerts = restriction_alerts(request.user)

        return Response({
            "date": today.isoformat(),
            "total_agents": total_agents,
            "present_today": present,
            "absent_today": absent,
            "excused_today": excused,
            "status_counts": status_counts,
            "district_stats": district_stats,
            "active_restrictions": restrictions.count(),
            "restriction_alerts": alerts,
        })
