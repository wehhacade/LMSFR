"""App installation & usage report — period-scoped activity, top registrars, inactive agents."""

from __future__ import annotations

from collections import defaultdict
from datetime import date as date_cls

from django.contrib.auth.models import Group
from django.db.models import Case, Count, IntegerField, Max, Prefetch, Q, Value, When
from django.utils import timezone

from apps.accounts.models import Agent
from apps.accounts.services.app_activity import iso_or_none, mobile_login_events, relative_period_activity_label
from apps.personnel.scope import scope_agents_queryset
from apps.suspects.models import Suspect


def _parse_period(date_from: str | None, date_to: str | None) -> tuple[date_cls, date_cls]:
    today = timezone.localdate()
    start = date_cls.fromisoformat(date_from) if date_from else today.replace(day=1)
    end = date_cls.fromisoformat(date_to) if date_to else today
    if end < start:
        start, end = end, start
    return start, end


def _agent_county_name(agent) -> str:
    if agent.county_id and agent.county:
        return agent.county.name
    if agent.user_id and getattr(agent.user, "county_id", None) and agent.user.county:
        return agent.user.county.name
    return ""


def _agent_section_name(agent) -> str:
    if agent.user_id and getattr(agent.user, "department_id", None) and agent.user.department:
        return agent.user.department.name
    if agent.department_id and agent.department:
        return agent.department.name
    return ""


def _installation(agent):
    if not agent.user_id:
        return None
    return getattr(agent.user, "app_installation", None)


def _agent_display_name(agent) -> str:
    parts = [
        getattr(agent, "first_name", "") or "",
        getattr(agent, "father_name", "") or "",
        getattr(agent, "last_name", "") or "",
        getattr(agent, "fourth_name", "") or "",
    ]
    name = " ".join(p.strip() for p in parts if p and p.strip()).strip()
    if name:
        return name
    full = (getattr(agent, "personal_fullname", "") or "").strip()
    if full:
        return full
    if agent.user_id and getattr(agent, "user", None):
        user = agent.user
        user_name = (user.get_full_name() or "").strip()
        if user_name:
            return user_name
        user_parts = [user.first_name or "", user.last_name or ""]
        user_name = " ".join(p.strip() for p in user_parts if p.strip()).strip()
        if user_name:
            return user_name
    return agent.service_id or agent.personal_number or ""


def _scoped_agents(viewer, *, county_id: str = "", department_id: str = "", installed_only: bool = True):
    qs = (
        Agent.objects.select_related(
            "user",
            "user__county",
            "user__department",
            "user__app_installation",
            "county",
            "department",
        )
        .prefetch_related(Prefetch("user__groups", queryset=Group.objects.only("id", "name")))
        .exclude(user__is_superuser=True)
        .annotate(
            _has_user=Case(
                When(user_id__isnull=False, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            ),
        )
        .order_by("_has_user", "-service_id")
    )
    qs = scope_agents_queryset(qs, viewer)

    if county_id:
        qs = qs.filter(Q(county_id=county_id) | Q(user__county_id=county_id))
    if department_id:
        from apps.accounts.models import Department as Dept

        county_ids = list(
            Dept.objects.filter(pk=department_id).values_list("counties__id", flat=True).distinct()
        )
        county_ids = [cid for cid in county_ids if cid is not None]
        dept_q = Q(department_id=department_id) | Q(user__department_id=department_id)
        if county_ids:
            qs = qs.filter(Q(county_id__in=county_ids) | Q(user__county_id__in=county_ids) | dept_q)
        else:
            qs = qs.filter(dept_q)

    if installed_only:
        qs = qs.filter(user__app_installation__status="completed")

    return list(qs)


def _period_stats(user_ids: list[int], start: date_cls, end: date_cls) -> tuple[dict, dict]:
    """Return suspect stats and login stats keyed by user_id for the period."""
    if not user_ids:
        return {}, {}

    suspect_rows = (
        Suspect.objects.filter(
            created_by_id__in=user_ids,
            created_at__date__gte=start,
            created_at__date__lte=end,
        )
        .values("created_by_id")
        .annotate(period_count=Count("id"), last_at=Max("created_at"))
    )
    suspect_stats = {
        row["created_by_id"]: {"count": row["period_count"], "last_at": row["last_at"]}
        for row in suspect_rows
    }

    login_rows = (
        mobile_login_events()
        .filter(
            user_id__in=user_ids,
            created_at__date__gte=start,
            created_at__date__lte=end,
        )
        .values("user_id")
        .annotate(period_count=Count("id"), last_at=Max("created_at"))
    )
    login_stats = {
        row["user_id"]: {"count": row["period_count"], "last_at": row["last_at"]}
        for row in login_rows
    }
    return suspect_stats, login_stats


def _registrar_from_agent(agent, *, count: int) -> dict:
    return {
        "agent_id": agent.pk,
        "user_id": agent.user_id,
        "service_id": agent.service_id or agent.personal_number or "",
        "name": _agent_display_name(agent),
        "phone": agent.phone or (agent.user.phone if agent.user_id else ""),
        "county_name": _agent_county_name(agent),
        "section_name": _agent_section_name(agent),
        "suspects_registered": count,
    }


def _top_from_agents(agents: list[Agent], suspect_stats: dict, *, limit: int = 3) -> list[dict]:
    ranked = []
    for agent in agents:
        if not agent.user_id:
            continue
        count = suspect_stats.get(agent.user_id, {}).get("count", 0)
        if count > 0:
            ranked.append(_registrar_from_agent(agent, count=count))
    ranked.sort(key=lambda r: (-r["suspects_registered"], r["name"]))
    return ranked[:limit]


def _agent_row(agent, *, suspect_stats: dict, login_stats: dict, now, start: date_cls, end: date_cls) -> dict:
    installation = _installation(agent)
    installed_at = installation.installed_at if installation and installation.status == "completed" else None
    uid = agent.user_id

    s_stat = suspect_stats.get(uid, {}) if uid else {}
    l_stat = login_stats.get(uid, {}) if uid else {}
    period_suspects = int(s_stat.get("count") or 0)
    period_logins = int(l_stat.get("count") or 0)
    last_suspect = s_stat.get("last_at")
    last_login = l_stat.get("last_at")

    installed_in_period = False
    if installed_at:
        installed_at = _aware_dt(installed_at)
        installed_in_period = start <= installed_at.date() <= end

    last_period_activity = last_suspect
    if last_login and (not last_period_activity or last_login > last_period_activity):
        last_period_activity = last_login
    if installed_in_period and (
        not last_period_activity or installed_at > _aware_dt(last_period_activity)
    ):
        last_period_activity = installed_at

    if installed_in_period and period_logins == 0:
        period_logins = 1

    period_has_suspects = period_suspects > 0
    period_has_activity = period_suspects > 0 or period_logins > 0 or installed_in_period

    return {
        "agent_id": agent.pk,
        "user_id": uid,
        "service_id": agent.service_id or agent.personal_number or "",
        "name": _agent_display_name(agent),
        "phone": agent.phone or (agent.user.phone if uid else ""),
        "county_name": _agent_county_name(agent),
        "section_name": _agent_section_name(agent),
        "app_installed": installation.status == "completed" if installation else False,
        "installation_status": installation.status if installation else "not_installed",
        "installed_at": iso_or_none(installed_at),
        "period_suspects_registered": period_suspects,
        "period_app_opens": period_logins,
        "period_has_suspects": period_has_suspects,
        "period_has_activity": period_has_activity,
        "last_period_suspect_at": iso_or_none(last_suspect),
        "last_period_activity_at": iso_or_none(last_period_activity),
        "last_period_activity_relative": relative_period_activity_label(
            last_period_activity,
            now=now,
            installed_in_period=installed_in_period,
        ),
        "is_active": bool(agent.user and agent.user.is_active and not agent.user.suspend),
    }


def _aware_dt(dt):
    if not dt:
        return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def build_app_usage_report(
    viewer,
    *,
    county_id: str = "",
    department_id: str = "",
    date_from: str | None = None,
    date_to: str | None = None,
    installed_only: bool = True,
) -> dict:
    now = timezone.now()
    start, end = _parse_period(date_from, date_to)
    agents = _scoped_agents(
        viewer,
        county_id=county_id,
        department_id=department_id,
        installed_only=installed_only,
    )

    section_agents: list[Agent] | None = None
    district_agents: list[Agent] | None = None
    if department_id and county_id:
        section_agents = _scoped_agents(
            viewer,
            department_id=department_id,
            installed_only=installed_only,
        )
        district_agents = _scoped_agents(
            viewer,
            county_id=county_id,
            installed_only=installed_only,
        )
    elif department_id:
        section_agents = agents
    elif county_id:
        district_agents = agents

    scoped_lists = [agents]
    if section_agents is not None and section_agents is not agents:
        scoped_lists.append(section_agents)
    if district_agents is not None and district_agents is not agents:
        scoped_lists.append(district_agents)
    user_ids = list({a.user_id for group in scoped_lists for a in group if a.user_id})
    suspect_stats, login_stats = _period_stats(user_ids, start, end)

    rows = [_agent_row(a, suspect_stats=suspect_stats, login_stats=login_stats, now=now, start=start, end=end) for a in agents]
    installed_rows = [r for r in rows if r["app_installed"]]
    active_rows = [r for r in installed_rows if r["period_has_suspects"]]
    inactive_rows = [r for r in installed_rows if not r["period_has_suspects"]]

    district_map: dict[str, list[Agent]] = defaultdict(list)
    section_map: dict[str, list[Agent]] = defaultdict(list)
    for agent in agents:
        district_map[_agent_county_name(agent) or "Unassigned"].append(agent)
        section_map[_agent_section_name(agent) or "Unassigned"].append(agent)

    district_breakdown = []
    for name in sorted(district_map.keys()):
        group = district_map[name]
        group_rows = [r for r in rows if (r["county_name"] or "Unassigned") == name]
        district_breakdown.append({
            "name": name,
            "total_installed": sum(1 for r in group_rows if r["app_installed"]),
            "active_in_period": sum(1 for r in group_rows if r["period_has_suspects"]),
            "inactive_in_period": sum(1 for r in group_rows if r["app_installed"] and not r["period_has_suspects"]),
            "total_suspects": sum(r["period_suspects_registered"] for r in group_rows),
            "top_registrars": _top_from_agents(group, suspect_stats, limit=3),
        })

    section_breakdown = []
    selected_section_name = ""
    selected_district_name = ""
    if department_id:
        from apps.accounts.models import Department as Dept

        dept = Dept.objects.filter(pk=department_id).only("name").first()
        selected_section_name = dept.name if dept else ""
    if county_id:
        from apps.accounts.models import County

        county = County.objects.filter(pk=county_id).only("name").first()
        selected_district_name = county.name if county else ""

    for name in sorted(section_map.keys()):
        group = section_map[name]
        group_rows = [r for r in rows if (r["section_name"] or "Unassigned") == name]
        section_breakdown.append({
            "name": name,
            "total_installed": sum(1 for r in group_rows if r["app_installed"]),
            "active_in_period": sum(1 for r in group_rows if r["period_has_suspects"]),
            "inactive_in_period": sum(1 for r in group_rows if r["app_installed"] and not r["period_has_suspects"]),
            "total_suspects": sum(r["period_suspects_registered"] for r in group_rows),
            "top_registrars": _top_from_agents(group, suspect_stats, limit=3),
        })

    top_overall = _top_from_agents(agents, suspect_stats, limit=10)
    top3_overall = top_overall[:3]

    section_top3: list[dict] = []
    district_top3: list[dict] = []
    if section_agents is not None:
        section_top3 = _top_from_agents(section_agents, suspect_stats, limit=3)
    if district_agents is not None:
        district_top3 = _top_from_agents(district_agents, suspect_stats, limit=3)

    return {
        "generated_at": now.isoformat(),
        "period": {"date_from": start.isoformat(), "date_to": end.isoformat()},
        "filters": {
            "county_id": county_id or None,
            "department_id": department_id or None,
            "installed_only": installed_only,
        },
        "summary": {
            "total_installed": len(installed_rows),
            "active_in_period": len(active_rows),
            "inactive_in_period": len(inactive_rows),
            "total_suspects_in_period": sum(r["period_suspects_registered"] for r in installed_rows),
            "total_app_opens_in_period": sum(r["period_app_opens"] for r in installed_rows),
        },
        "top_registrars": {
            "overall_top3": top3_overall if not (department_id or county_id) else [],
            "overall_top10": top_overall if not (department_id or county_id) else [],
            "section_top3": section_top3,
            "district_top3": district_top3,
            "section_name": selected_section_name or None,
            "district_name": selected_district_name or None,
            "by_district": {d["name"]: d["top_registrars"] for d in district_breakdown if d["top_registrars"]},
            "by_section": {s["name"]: s["top_registrars"] for s in section_breakdown if s["top_registrars"]},
        },
        "district_breakdown": district_breakdown,
        "section_breakdown": section_breakdown,
        "active_agents": active_rows,
        "inactive_agents": inactive_rows,
        "agents": installed_rows,
    }
