"""Personnel report builders."""

from __future__ import annotations

from datetime import date, timedelta
from io import BytesIO

import openpyxl
from django.db.models import Count, Q
from django.utils import timezone

from apps.accounts.models import Agent, County, Department
from apps.personnel.models import (
    AgentAssignmentHistory,
    AgentAttendanceRecord,
    AgentRestriction,
)
from apps.personnel.scope import scope_agents_queryset, scope_counties_queryset
from apps.personnel.services.agent_presenters import (
    agent_county_name,
    agent_department_name,
    agent_report_name,
)


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        return None


def build_agent_report(user, *, county_id=None, department_id=None, status_code=None, search=None):
    qs = scope_agents_queryset(
        Agent.objects.select_related(
            "county",
            "department",
            "agent_status",
            "user",
            "user__county",
            "user__department",
        ).prefetch_related("county__departments").filter(is_archived=False),
        user,
    )
    if county_id:
        qs = qs.filter(county_id=county_id)
    if department_id:
        qs = qs.filter(
            Q(department_id=department_id)
            | Q(user__department_id=department_id)
            | Q(county__departments__id=department_id)
        ).distinct()
    if status_code:
        qs = qs.filter(agent_status__code=status_code)
    if search:
        qs = qs.filter(
            Q(service_id__icontains=search)
            | Q(personal_fullname__icontains=search)
            | Q(first_name__icontains=search)
            | Q(father_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(phone__icontains=search)
        )
    rows = []
    for agent in qs.order_by("service_id", "first_name")[:5000]:
        rows.append({
            "service_id": agent.service_id or "",
            "name": agent_report_name(agent),
            "phone": agent.phone,
            "county": agent_county_name(agent),
            "department": agent_department_name(agent),
            "status": agent.agent_status.name if agent.agent_status_id else agent.status,
            "present": agent.present,
            "position": agent.position_title or "",
            "weapon": agent.weapon_name or "",
        })
    return {"total": len(rows), "rows": rows}


def build_attendance_report(
    user,
    *,
    date_from=None,
    date_to=None,
    county_id=None,
    department_id=None,
    agent_id=None,
    status_code=None,
    view: str = "detail",
):
    qs = AgentAttendanceRecord.objects.select_related(
        "agent",
        "agent__county",
        "agent__department",
        "agent__user",
        "agent__user__county",
        "agent__user__department",
        "county",
        "status",
        "absence_reason",
        "session",
        "session__department",
        "department",
    ).order_by("-recorded_at")
    qs = scope_agents_queryset(qs, user)

    if date_from:
        qs = qs.filter(session__date__gte=date_from)
    if date_to:
        qs = qs.filter(session__date__lte=date_to)
    if county_id:
        qs = qs.filter(county_id=county_id)
    if department_id:
        section_county_ids = list(
            Department.objects.filter(pk=department_id).values_list("counties__id", flat=True).distinct()
        )
        section_county_ids = [cid for cid in section_county_ids if cid is not None]
        dept_q = Q(session__department_id=department_id) | Q(department_id=department_id)
        if section_county_ids:
            dept_q |= Q(county_id__in=section_county_ids)
        qs = qs.filter(dept_q).distinct()
    if agent_id:
        qs = qs.filter(agent_id=agent_id)
    if status_code:
        qs = qs.filter(status__code=status_code)

    if view == "district":
        return _build_attendance_district_summary(qs)

    rows = []
    for rec in qs[:5000]:
        rows.append({
            "date": rec.session.date.isoformat() if rec.session_id else "",
            "session": rec.session.session if rec.session_id else "",
            "service_id": rec.agent.service_id or "",
            "name": agent_report_name(rec.agent),
            "county": rec.county.name if rec.county_id else agent_county_name(rec.agent),
            "department": (
                rec.session.department.name
                if rec.session_id and rec.session.department_id
                else agent_department_name(rec.agent)
            ),
            "status": rec.status.name if rec.status_id else "",
            "absence_reason": rec.absence_reason.name if rec.absence_reason_id else "",
            "notes": rec.notes,
            "recorded_at": rec.recorded_at.isoformat(),
        })
    return {"total": len(rows), "view": "detail", "rows": rows}


def _build_attendance_district_summary(qs):
    """Aggregate attendance records per district with status/reason breakdown."""
    county_ids = list(qs.values_list("county_id", flat=True).distinct())
    counties = {
        c.id: c.name
        for c in County.objects.filter(pk__in=[cid for cid in county_ids if cid]).only("id", "name")
    }

    def count_for(county_id, **filters):
        base = qs.filter(county_id=county_id)
        return base.filter(**filters).count()

    rows = []
    for county_id in sorted(county_ids, key=lambda cid: counties.get(cid or 0, "")):
        present = count_for(county_id, status__code="PRESENT")
        absent = count_for(county_id, status__code="ABSENT", absence_reason__isnull=True)
        lama_haayo = count_for(county_id, status__code="ABSENT", absence_reason__code="MISSING")
        fakad = count_for(county_id, status__code="ABSENT", absence_reason__code="ABSCONDED")
        dhaawac = count_for(county_id, status__code="ABSENT", absence_reason__code="INJURY")
        la_xiray = count_for(county_id, status__code="ABSENT", absence_reason__code="ARRESTED")
        fasax = qs.filter(county_id=county_id).filter(
            Q(status__code="EXCUSED") | Q(absence_reason__code="LEAVE")
        ).count()
        badal = count_for(county_id, absence_reason__code="TRANSFERRED")
        other = count_for(county_id, absence_reason__code="OTHER")
        total = qs.filter(county_id=county_id).count()
        rows.append({
            "district": counties.get(county_id, "—") if county_id else "—",
            "present": present,
            "absent": absent,
            "lama_haayo": lama_haayo,
            "fakad": fakad,
            "dhaawac": dhaawac,
            "la_xiray": la_xiray,
            "fasax": fasax,
            "badal": badal,
            "other": other,
            "total": total,
        })

    rows.sort(key=lambda r: (-r["total"], r["district"]))
    return {"total": len(rows), "view": "district", "rows": rows}


def build_transfer_report(user, *, date_from=None, date_to=None, county_id=None):
    qs = AgentAssignmentHistory.objects.select_related(
        "agent", "from_county", "to_county", "performed_by",
    ).order_by("-transfer_date")
    county_ids = None
    from apps.personnel.scope import caller_county_ids
    allowed = caller_county_ids(user)
    if allowed is not None:
        if not allowed:
            return {"total": 0, "rows": []}
        qs = qs.filter(
            Q(from_county_id__in=allowed) | Q(to_county_id__in=allowed) | Q(agent__county_id__in=allowed)
        )
    if date_from:
        qs = qs.filter(transfer_date__gte=date_from)
    if date_to:
        qs = qs.filter(transfer_date__lte=date_to)
    if county_id:
        qs = qs.filter(Q(from_county_id=county_id) | Q(to_county_id=county_id))

    rows = []
    for t in qs[:5000]:
        rows.append({
            "transfer_date": t.transfer_date.isoformat(),
            "service_id": t.agent.service_id or "",
            "name": agent_report_name(t.agent),
            "from_county": t.from_county.name if t.from_county_id else "",
            "to_county": t.to_county.name if t.to_county_id else "",
            "reason": t.reason,
            "performed_by": (t.performed_by.get_full_name() or t.performed_by.email) if t.performed_by_id else "",
            "notes": t.notes,
        })
    return {"total": len(rows), "rows": rows}


def build_restriction_report(user, *, status=None, county_id=None):
    qs = AgentRestriction.objects.select_related("agent", "agent__county").order_by("-start_date")
    qs = scope_agents_queryset(qs, user)
    if status:
        qs = qs.filter(status=status)
    if county_id:
        qs = qs.filter(agent__county_id=county_id)

    today = timezone.now().date()
    rows = []
    for r in qs[:5000]:
        rows.append({
            "service_id": r.agent.service_id or "",
            "name": agent_report_name(r.agent),
            "county": r.agent.county.name if r.agent.county_id else "",
            "reason": r.reason,
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat(),
            "status": r.status,
            "id_card": r.id_card_status,
            "weapon": r.weapon_status,
            "expired": r.end_date < today,
            "notes": r.notes,
        })
    return {"total": len(rows), "rows": rows}


def build_district_summary_report(user):
    counties = scope_counties_queryset(County.objects.select_related("region").order_by("name"), user)
    agents_qs = scope_agents_queryset(Agent.objects.filter(is_archived=False), user)
    today = timezone.now().date()
    sessions_today = AgentAttendanceRecord.objects.filter(session__date=today)

    rows = []
    for county in counties:
        county_agents = agents_qs.filter(county=county)
        total = county_agents.count()
        active = county_agents.filter(agent_status__code="ACTIVE").count() if total else 0
        restricted = county_agents.filter(restrictions__status=AgentRestriction.Status.ACTIVE).distinct().count()
        present = sessions_today.filter(county=county, status__code="PRESENT").count()
        rows.append({
            "county_id": county.id,
            "county_name": county.name,
            "total_agents": total,
            "active_agents": active,
            "restricted": restricted,
            "present_today": present,
            "attendance_pct": round((present / total) * 100, 1) if total else 0,
        })
    return {"total": len(rows), "rows": rows}


def build_section_summary_report(user):
    departments = Department.objects.prefetch_related("counties").order_by("name")
    from apps.personnel.scope import scope_departments_queryset
    departments = scope_departments_queryset(departments, user)
    agents_qs = scope_agents_queryset(Agent.objects.filter(is_archived=False), user)
    today = timezone.now().date()

    rows = []
    for dept in departments:
        county_ids = list(dept.counties.values_list("id", flat=True))
        dept_agents = agents_qs.filter(
            Q(department_id=dept.id) | Q(county_id__in=county_ids)
        ).distinct()
        total = dept_agents.count()
        present = AgentAttendanceRecord.objects.filter(
            session__date=today,
            status__code="PRESENT",
            agent__in=dept_agents,
        ).count()
        rows.append({
            "department_id": dept.id,
            "department_name": dept.name,
            "district_count": len(county_ids),
            "total_agents": total,
            "present_today": present,
            "attendance_pct": round((present / total) * 100, 1) if total else 0,
            "districts": [c.name for c in dept.counties.all()],
        })
    return {"total": len(rows), "rows": rows}


def restriction_alerts(user):
    today = timezone.now().date()
    week = today + timedelta(days=7)
    qs = AgentRestriction.objects.filter(status=AgentRestriction.Status.ACTIVE).select_related("agent")
    qs = scope_agents_queryset(qs, user)
    return {
        "expired": qs.filter(end_date__lt=today).count(),
        "expiring_today": qs.filter(end_date=today).count(),
        "expiring_within_7_days": qs.filter(end_date__gt=today, end_date__lte=week).count(),
        "items": list(
            qs.filter(end_date__lte=week).order_by("end_date")[:20].values(
                "id", "agent__service_id", "agent__personal_fullname", "end_date", "reason", "status",
            )
        ),
    }


def export_rows_to_xlsx(sheet_name: str, rows: list[dict]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_name[:31]
    if not rows:
        ws.append(["No data"])
    else:
        headers = list(rows[0].keys())
        ws.append(headers)
        for row in rows:
            ws.append([row.get(h, "") for h in headers])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
