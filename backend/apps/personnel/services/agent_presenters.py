"""Shared agent display helpers for personnel reports, attendance, and serializers."""

from __future__ import annotations

from apps.accounts.models import Agent
from apps.personnel.services.import_service import agent_display_name


def agent_county_name(agent: Agent) -> str:
    if agent.county_id and agent.county:
        return agent.county.name
    user = getattr(agent, "user", None)
    if user and user.county_id and user.county:
        return user.county.name
    return ""


def agent_department_name(agent: Agent) -> str:
    if agent.department_id and agent.department:
        return agent.department.name
    user = getattr(agent, "user", None)
    if user and user.department_id and user.department:
        return user.department.name
    if agent.county_id and agent.county:
        dept = agent.county.departments.first()
        if dept:
            return dept.name
    return ""


def agent_report_name(agent: Agent) -> str:
    return agent_display_name(agent) or agent.personal_fullname or ""
