"""Merge duplicate agent records (e.g. import conflicts from phone format differences)."""

from __future__ import annotations

from django.apps import apps
from django.db import models, transaction

from apps.accounts.models import Agent
from apps.personnel.services.import_service import agent_display_name, emp_no_variants, normalize_phone


class AgentMergeError(Exception):
    pass


def canonicalize_phone(phone: str | None) -> str:
    """Normalize to the 9-digit local form used across the system."""
    return normalize_phone(phone)


def agent_snapshot(agent: Agent, *, match_method: str = "") -> dict:
    return {
        "id": agent.pk,
        "service_id": agent.service_id or "",
        "nickname": agent.nickname or "",
        "phone": agent.phone or "",
        "name": agent.personal_fullname or agent_display_name(agent) or str(agent),
        "match_method": match_method,
        "district": agent.county.name if agent.county_id else None,
        "department": agent.department.name if agent.department_id else None,
    }


def pick_primary_agent(agents: list[Agent], *, excel_service_id: str = "") -> Agent:
    if not agents:
        raise AgentMergeError("No agents to merge.")
    if len(agents) == 1:
        return agents[0]

    sid = str(excel_service_id or "").strip()
    sid_variants = emp_no_variants(sid) if sid else set()

    def score(agent: Agent) -> tuple[int, int, int]:
        nick = (agent.nickname or "").strip()
        service_id = (agent.service_id or "").strip()
        name = agent.personal_fullname or agent_display_name(agent)
        points = 0
        if sid and (nick in sid_variants or service_id in sid_variants):
            points += 100
        if nick and nick.isdigit():
            points += 20
        if service_id and service_id.isdigit() and len(service_id) >= 8:
            points += 15
        if name:
            points += 10
        if agent.county_id:
            points += 5
        if agent.department_id:
            points += 3
        return (points, len(name), -agent.pk)

    return sorted(agents, key=score, reverse=True)[0]


def _reassign_agent_foreign_keys(primary: Agent, secondary: Agent) -> None:
    for model in apps.get_models():
        if model is Agent:
            continue
        for field in model._meta.fields:
            if not isinstance(field, models.ForeignKey):
                continue
            if field.remote_field.model is not Agent:
                continue
            model.objects.filter(**{field.name: secondary}).update(**{field.name: primary})


def _merge_scalar_fields(primary: Agent, secondary: Agent) -> None:
    fill_fields = [
        "first_name",
        "father_name",
        "last_name",
        "fourth_name",
        "mother_name",
        "nickname",
        "email",
        "gender",
        "weapon_name",
        "serial_number",
        "tribe_name",
        "region_name",
        "sub_county_name",
        "section_name",
        "position_title",
        "team_name",
        "unit_name",
        "notes",
        "biography",
        "assignment_status",
        "id_card_status",
        "weapon_status",
        "date_of_birth",
        "date_joined",
    ]
    for field_name in fill_fields:
        current = getattr(primary, field_name, None)
        incoming = getattr(secondary, field_name, None)
        if not current and incoming:
            setattr(primary, field_name, incoming)

    if not primary.county_id and secondary.county_id:
        primary.county = secondary.county
    if not primary.department_id and secondary.department_id:
        primary.department = secondary.department
    if not primary.agent_status_id and secondary.agent_status_id:
        primary.agent_status = secondary.agent_status
    if not primary.directorate_id and secondary.directorate_id:
        primary.directorate = secondary.directorate


def _archive_merged_agent(agent: Agent) -> None:
    agent.service_id = None
    agent.is_archived = True
    agent.phone = f"arc{agent.pk}"[-15:]
    if agent.user_id:
        user = agent.user
        user.suspend = True
        user.is_active = False
        user.save(update_fields=["suspend", "is_active"])
    agent.save(update_fields=["service_id", "is_archived", "phone", "updated_at"])


@transaction.atomic
def merge_agents(
    *,
    agent_ids: list[int],
    excel_service_id: str = "",
    preferred_phone: str = "",
    performed_by=None,
) -> dict:
    unique_ids = []
    for agent_id in agent_ids:
        if agent_id and agent_id not in unique_ids:
            unique_ids.append(int(agent_id))
    if len(unique_ids) < 2:
        raise AgentMergeError("Select at least two agents to merge.")

    agents = list(
        Agent.objects.filter(pk__in=unique_ids, is_archived=False).select_related("county", "department")
    )
    if len(agents) < 2:
        raise AgentMergeError("One or more agents were not found or are already archived.")

    primary = pick_primary_agent(agents, excel_service_id=excel_service_id)
    secondaries = [agent for agent in agents if agent.pk != primary.pk]

    sid = str(excel_service_id or "").strip()
    if sid:
        if not primary.service_id or primary.service_id != sid:
            if Agent.objects.filter(service_id=sid).exclude(pk=primary.pk).exists():
                raise AgentMergeError(f"Emp No {sid} is already assigned to another agent.")
            primary.service_id = sid
        nick = (primary.nickname or "").strip()
        if not nick or nick.isdigit():
            primary.nickname = sid

    for secondary in secondaries:
        secondary_phone = secondary.phone
        _reassign_agent_foreign_keys(primary, secondary)
        _archive_merged_agent(secondary)
        if preferred_phone or secondary_phone:
            normalized = canonicalize_phone(preferred_phone or secondary_phone)
            if normalized and canonicalize_phone(primary.phone) != normalized:
                if not Agent.objects.filter(phone=normalized).exclude(pk=primary.pk).exists():
                    primary.phone = normalized
        _merge_scalar_fields(primary, secondary)

    primary.save()
    return {
        "primary_agent": agent_snapshot(primary),
        "merged_agent_ids": [agent.pk for agent in secondaries],
        "performed_by": getattr(performed_by, "pk", None),
    }
