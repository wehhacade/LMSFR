from __future__ import annotations

from datetime import date

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Agent, County, Department
from apps.personnel.models import (
    AgentAssignmentHistory,
    AgentRestriction,
    AgentRestrictionAction,
    AgentStatus,
    AgentStatusHistory,
    AttendanceStatus,
)
from apps.personnel.scope import user_can_access_agent, user_can_access_county


def transfer_agent(
    *,
    agent: Agent,
    to_county: County,
    to_department: Department | None,
    reason: str,
    transfer_date: date,
    performed_by,
    notes: str = "",
    skip_scope_check: bool = False,
) -> AgentAssignmentHistory:
    if not skip_scope_check:
        if not user_can_access_agent(performed_by, agent):
            raise PermissionError("You cannot transfer agents outside your district scope.")
        if not user_can_access_county(performed_by, to_county.id):
            raise PermissionError("Destination district is outside your scope.")

    old_county = agent.county
    old_department = getattr(agent, "department", None)

    with transaction.atomic():
        history = AgentAssignmentHistory.objects.create(
            agent=agent,
            from_county=old_county,
            to_county=to_county,
            from_department=old_department,
            to_department=to_department,
            reason=reason,
            transfer_date=transfer_date,
            notes=notes,
            performed_by=performed_by,
        )
        agent.county = to_county
        if to_department is not None:
            agent.department = to_department
        agent.save(update_fields=["county", "department", "updated_at"])

        if agent.user_id:
            agent.user.county = to_county
            if to_department is not None:
                agent.user.department = to_department
            agent.user.save(update_fields=["county", "department"])

        transferred_status = AgentStatus.objects.filter(code="TRANSFERRED").first()
        if transferred_status and getattr(agent, "agent_status_id", None) != transferred_status.id:
            old_status_id = getattr(agent, "agent_status_id", None)
            AgentStatusHistory.objects.create(
                agent=agent,
                old_status_id=old_status_id,
                new_status=transferred_status,
                reason=reason,
                changed_by=performed_by,
            )
            agent.agent_status = transferred_status
            agent.save(update_fields=["agent_status", "updated_at"])

    return history


def release_agent_from_section(
    *,
    agent: Agent,
    section_department: Department,
    section_county_ids: set[int],
    reason: str,
    transfer_date: date,
    performed_by,
    notes: str = "",
) -> AgentAssignmentHistory | None:
    """Detach an agent from a section roster without deleting the record."""
    old_county = agent.county
    old_department = agent.department
    county_in_section = bool(agent.county_id and agent.county_id in section_county_ids)
    dept_in_section = bool(agent.department_id and agent.department_id == section_department.id)

    if not county_in_section and not dept_in_section:
        return None

    with transaction.atomic():
        history = AgentAssignmentHistory.objects.create(
            agent=agent,
            from_county=old_county,
            to_county=None,
            from_department=old_department,
            to_department=None,
            reason=reason,
            transfer_date=transfer_date,
            notes=notes,
            performed_by=performed_by,
        )
        if dept_in_section:
            agent.department = None
        if county_in_section:
            agent.county = None
        agent.save(update_fields=["county", "department", "updated_at"])

        if agent.user_id:
            user = agent.user
            if dept_in_section:
                user.department = None
            if county_in_section:
                user.county = None
            user.save(update_fields=["county", "department"])

    return history


def create_restriction(
    *,
    agent: Agent,
    reason: str,
    start_date: date,
    end_date: date,
    id_card_withheld: bool,
    weapon_withheld: bool,
    notes: str,
    created_by,
) -> AgentRestriction:
    if not user_can_access_agent(created_by, agent):
        raise PermissionError("Agent is outside your scope.")

    from apps.personnel.models.restriction import AgentRestriction as RestrictionModel

    return RestrictionModel.objects.create(
        agent=agent,
        reason=reason,
        start_date=start_date,
        end_date=end_date,
        id_card_status=RestrictionModel.ItemStatus.HELD if id_card_withheld else RestrictionModel.ItemStatus.NOT_APPLICABLE,
        weapon_status=RestrictionModel.ItemStatus.HELD if weapon_withheld else RestrictionModel.ItemStatus.NOT_APPLICABLE,
        notes=notes,
        created_by=created_by,
    )


def release_restriction(*, restriction: AgentRestriction, performed_by, notes: str = "") -> AgentRestriction:
    if not user_can_access_agent(performed_by, restriction.agent):
        raise PermissionError("Agent is outside your scope.")

    with transaction.atomic():
        restriction.status = AgentRestriction.Status.RELEASED
        restriction.released_by = performed_by
        restriction.released_at = timezone.now()
        restriction.id_card_status = AgentRestriction.ItemStatus.RETURNED
        restriction.weapon_status = AgentRestriction.ItemStatus.RETURNED
        restriction.save()

        AgentRestrictionAction.objects.create(
            restriction=restriction,
            action=AgentRestrictionAction.ActionType.RELEASE,
            notes=notes,
            performed_by=performed_by,
        )

        active_status = AgentStatus.objects.filter(code="ACTIVE").first()
        agent = restriction.agent
        if active_status:
            AgentStatusHistory.objects.create(
                agent=agent,
                old_status=getattr(agent, "agent_status", None),
                new_status=active_status,
                reason="Restriction released",
                changed_by=performed_by,
            )
            agent.agent_status = active_status
            agent.save(update_fields=["agent_status", "updated_at"])

    return restriction


def extend_restriction(
    *,
    restriction: AgentRestriction,
    new_end_date: date,
    new_reason: str,
    performed_by,
    notes: str = "",
) -> AgentRestriction:
    if not user_can_access_agent(performed_by, restriction.agent):
        raise PermissionError("Agent is outside your scope.")

    with transaction.atomic():
        restriction.end_date = new_end_date
        restriction.status = AgentRestriction.Status.EXTENDED
        if new_reason:
            restriction.reason = new_reason
        restriction.save()

        AgentRestrictionAction.objects.create(
            restriction=restriction,
            action=AgentRestrictionAction.ActionType.EXTEND,
            new_end_date=new_end_date,
            new_reason=new_reason,
            notes=notes,
            performed_by=performed_by,
        )
    return restriction


def get_or_create_attendance_status(code: str) -> AttendanceStatus:
    defaults = {"name": code.replace("_", " ").title()}
    status, _ = AttendanceStatus.objects.get_or_create(code=code, defaults=defaults)
    return status
