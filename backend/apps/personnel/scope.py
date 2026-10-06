"""Organizational scope enforcement for personnel/agent operations."""

from __future__ import annotations

from django.db.models import Q, QuerySet

from apps.accounts.call_roles import (
    is_dev,
    is_taliye_all,
    is_taliye_degmo,
    is_taliye_qebeed,
    qeyb_county_ids,
)


def caller_county_ids(user) -> list[int] | None:
    """Return county IDs the user may access, or None for org-wide access."""
    if is_dev(user) or is_taliye_all(user):
        return None
    if is_taliye_qebeed(user):
        ids = qeyb_county_ids(user)
        return ids if ids else []
    if is_taliye_degmo(user):
        county_id = getattr(user, "county_id", None)
        return [county_id] if county_id else []
    return None


def scope_agents_queryset(qs: QuerySet, user) -> QuerySet:
    county_ids = caller_county_ids(user)
    if county_ids is None:
        return qs
    if not county_ids:
        return qs.none()
    return qs.filter(Q(county_id__in=county_ids) | Q(user__county_id__in=county_ids))


def scope_counties_queryset(qs: QuerySet, user) -> QuerySet:
    county_ids = caller_county_ids(user)
    if county_ids is None:
        return qs
    if not county_ids:
        return qs.none()
    return qs.filter(pk__in=county_ids)


def scope_departments_queryset(qs: QuerySet, user) -> QuerySet:
    if is_dev(user) or is_taliye_all(user):
        return qs
    if is_taliye_qebeed(user):
        dept_id = getattr(user, "department_id", None)
        if dept_id:
            return qs.filter(pk=dept_id)
        return qs.none()
    if is_taliye_degmo(user):
        county_id = getattr(user, "county_id", None)
        if county_id:
            return qs.filter(counties__id=county_id).distinct()
        return qs.none()
    return qs


def user_can_access_county(user, county_id) -> bool:
    if county_id is None:
        return False
    allowed = caller_county_ids(user)
    if allowed is None:
        return True
    return county_id in allowed


def user_can_access_agent(user, agent) -> bool:
    county_id = getattr(agent, "county_id", None) or (
        getattr(getattr(agent, "user", None), "county_id", None)
        if getattr(agent, "user_id", None)
        else None
    )
    if county_id:
        return user_can_access_county(user, county_id)
    allowed = caller_county_ids(user)
    return allowed is None


def scope_agent_related_queryset(qs: QuerySet, user, agent_field: str = "agent") -> QuerySet:
    """Filter querysets that relate to agents via a FK (transfers, restrictions, etc.)."""
    county_ids = caller_county_ids(user)
    if county_ids is None:
        return qs
    if not county_ids:
        return qs.none()
    return qs.filter(**{f"{agent_field}__county_id__in": county_ids})


def scope_assignment_history_queryset(qs: QuerySet, user) -> QuerySet:
    county_ids = caller_county_ids(user)
    if county_ids is None:
        return qs
    if not county_ids:
        return qs.none()
    return qs.filter(
        Q(from_county_id__in=county_ids)
        | Q(to_county_id__in=county_ids)
        | Q(agent__county_id__in=county_ids)
    )
