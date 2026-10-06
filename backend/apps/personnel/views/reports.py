from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.personnel.permissions import AttendancePermission
from apps.personnel.services.reports import (
    build_agent_report,
    build_attendance_report,
    build_district_summary_report,
    build_restriction_report,
    build_section_summary_report,
    build_transfer_report,
    export_rows_to_xlsx,
    restriction_alerts,
    _parse_date,
)


class ReportViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, AttendancePermission]

    def _export_response(self, filename: str, rows: list[dict]):
        content = export_rows_to_xlsx("Report", rows)
        response = HttpResponse(
            content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=["get"], url_path="agents")
    def agents(self, request):
        params = request.query_params
        data = build_agent_report(
            request.user,
            county_id=params.get("county"),
            department_id=params.get("department"),
            status_code=params.get("status"),
            search=params.get("search"),
        )
        if params.get("export") == "xlsx":
            return self._export_response("agents-report.xlsx", data["rows"])
        return Response(data)

    @action(detail=False, methods=["get"], url_path="attendance")
    def attendance(self, request):
        params = request.query_params
        data = build_attendance_report(
            request.user,
            date_from=_parse_date(params.get("date_from")),
            date_to=_parse_date(params.get("date_to")),
            county_id=params.get("county"),
            department_id=params.get("department"),
            agent_id=params.get("agent"),
            status_code=params.get("status"),
            view=params.get("view") or "detail",
        )
        if params.get("export") == "xlsx":
            return self._export_response("attendance-report.xlsx", data["rows"])
        return Response(data)

    @action(detail=False, methods=["get"], url_path="transfers")
    def transfers(self, request):
        params = request.query_params
        data = build_transfer_report(
            request.user,
            date_from=_parse_date(params.get("date_from")),
            date_to=_parse_date(params.get("date_to")),
            county_id=params.get("county"),
        )
        if params.get("export") == "xlsx":
            return self._export_response("transfers-report.xlsx", data["rows"])
        return Response(data)

    @action(detail=False, methods=["get"], url_path="restrictions")
    def restrictions(self, request):
        params = request.query_params
        data = build_restriction_report(
            request.user,
            status=params.get("status"),
            county_id=params.get("county"),
        )
        if params.get("export") == "xlsx":
            return self._export_response("restrictions-report.xlsx", data["rows"])
        return Response(data)

    @action(detail=False, methods=["get"], url_path="district-summary")
    def district_summary(self, request):
        data = build_district_summary_report(request.user)
        if request.query_params.get("export") == "xlsx":
            return self._export_response("district-summary.xlsx", data["rows"])
        return Response(data)

    @action(detail=False, methods=["get"], url_path="section-summary")
    def section_summary(self, request):
        data = build_section_summary_report(request.user)
        if request.query_params.get("export") == "xlsx":
            return self._export_response("section-summary.xlsx", data["rows"])
        return Response(data)

    @action(detail=False, methods=["get"], url_path="restriction-alerts")
    def restriction_alerts(self, request):
        return Response(restriction_alerts(request.user))
