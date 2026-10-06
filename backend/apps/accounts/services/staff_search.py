"""Fast Staff payroll + Agents lookup (Search Staff)."""

from __future__ import annotations

import re

from django.db.models import Prefetch, Q

from apps.accounts.models import Agent, Staff
from apps.accounts.services.hrm_client import parse_search_terms
from django.contrib.auth.models import Group

APP_USERS_SEARCH_TERM_LIMIT = 80
_APP_USERS_LIST_SEP = re.compile(r"[,;\n\r|/]+")


def parse_app_users_search_terms(raw: str) -> list[str]:
    """Split Search agents into one name query or many EMP / 4-digit IDs."""
    raw = (raw or "").strip()
    if not raw:
        return []
    if _APP_USERS_LIST_SEP.search(raw):
        parts: list[str] = []
        for chunk in _APP_USERS_LIST_SEP.split(raw):
            for token in chunk.split():
                term = token.strip()
                if term and term not in parts:
                    parts.append(term)
        return parts[:APP_USERS_SEARCH_TERM_LIMIT]
    tokens = [token for token in raw.split() if token]
    if len(tokens) >= 2 and all(token.isdigit() for token in tokens):
        return tokens[:APP_USERS_SEARCH_TERM_LIMIT]
    return [raw]


def _app_users_term_q(term: str) -> Q:
    term = (term or "").strip()
    if not term:
        return Q()
    digits = "".join(ch for ch in term if ch.isdigit())
    compact = term.replace(" ", "").replace("+", "")
    if len(term) == 4 and term.isdigit():
        # Last-4 app login is the employee-number tail only, not service_id.
        return Q(nickname__endswith=term)
    if digits and compact == digits and len(digits) >= 5:
        stripped = digits.lstrip("0") or "0"
        variants = {term, digits, stripped, f"0{stripped}"}
        q = Q()
        for value in variants:
            q |= (
                Q(nickname=value)
                | Q(nickname__endswith=value)
                | Q(phone=value)
                | Q(user__phone=value)
            )
        try:
            pk = int(stripped)
            if pk > 0:
                q |= Q(user_id=pk) | Q(pk=pk)
        except ValueError:
            pass
        return q
    return (
        Q(nickname__icontains=term)
        | Q(user__username__icontains=term)
        | Q(phone__icontains=term)
        | Q(email__icontains=term)
        | Q(user__email__icontains=term)
        | Q(first_name__icontains=term)
        | Q(father_name__icontains=term)
        | Q(last_name__icontains=term)
        | Q(personal_fullname__icontains=term)
    )


def app_users_search_q(raw: str) -> Q | None:
    terms = parse_app_users_search_terms(raw)
    if not terms:
        return None
    combined = Q()
    for term in terms:
        combined |= _app_users_term_q(term)
    return combined


def exact_numeric_variants(term: str) -> set[str]:
    term = (term or "").strip()
    if not term or not term.isdigit():
        return {term} if term else set()
    stripped = term.lstrip("0") or "0"
    return {term, stripped}


def staff_query_for_variants(variants: set[str]):
    if not variants:
        return Staff.objects.none()
    q = Q()
    for v in variants:
        q |= Q(employee_id=v) | Q(number=v)
    return Staff.objects.filter(q)


def staff_matches_term(term: str):
    term = (term or "").strip()
    if not term:
        return Staff.objects.none()
    if not term.isdigit():
        return Staff.objects.filter(Q(employee_id=term) | Q(number=term))
    results = staff_query_for_variants(exact_numeric_variants(term))
    if results.exists():
        return results
    stripped = term.lstrip("0") or "0"
    if not term.startswith("0"):
        return staff_query_for_variants({"0" + stripped})
    return Staff.objects.none()


def agents_matches_term(term: str):
    term = (term or "").strip()
    if not term:
        return Agent.objects.none()

    q = (
        Q(personal_fullname__icontains=term)
        | Q(first_name__icontains=term)
        | Q(father_name__icontains=term)
        | Q(last_name__icontains=term)
        | Q(fourth_name__icontains=term)
        | Q(nickname__icontains=term)
        | Q(service_id__icontains=term)
        | Q(email__icontains=term)
    )
    if term.isdigit():
        for value in exact_numeric_variants(term):
            q |= Q(nickname=value) | Q(phone=value) | Q(service_id=value)
        if not term.startswith("0"):
            stripped = term.lstrip("0") or "0"
            q |= Q(nickname="0" + stripped) | Q(phone="0" + stripped)
    else:
        q |= Q(phone__icontains=term)

    return (
        Agent.objects.filter(q)
        .exclude(user__is_superuser=True)
        .select_related("user", "county")
        .prefetch_related(Prefetch("user__groups", queryset=Group.objects.only("id", "name")))
        .distinct()
    )


def staff_agent_lookup_q(staff: Staff) -> Q:
    employee_id = (staff.employee_id or "").strip()
    phone = (staff.number or "").strip()
    q = Q()
    if employee_id:
        q |= Q(nickname=employee_id)
        if employee_id.isdigit():
            for value in exact_numeric_variants(employee_id):
                q |= Q(nickname=value)
    if phone:
        if phone.isdigit():
            for value in exact_numeric_variants(phone):
                q |= Q(phone=value)
        else:
            q |= Q(phone=phone)
    return q


def agent_to_search_dict(agent: Agent) -> dict:
    user = agent.user
    groups = []
    if user is not None:
        groups = [{"id": g.id, "name": g.name} for g in user.groups.all()]
    return {
        "id": str(agent.pk),
        "service_id": agent.service_id or "",
        "name": agent.personal_number or "",
        "nickname": agent.nickname or "",
        "employee_id": (agent.nickname or agent.service_id or "").strip(),
        "phone": agent.phone or "",
        "email": agent.email or (user.email if user else ""),
        "county_name": agent.county.name if agent.county_id else "",
        "county_id": str(agent.county_id) if agent.county_id else None,
        "user_id": agent.user_id,
        "username": user.username if user else None,
        "user_is_active": bool(user and user.is_active and not user.suspend),
        "user_status": (
            "Active" if user and user.is_active and not user.suspend
            else "Inactive" if user else "No User"
        ),
        "groups": groups,
        "has_user": bool(user),
    }


def staff_to_dict(staff: Staff, *, has_agent: bool) -> dict:
    return {
        "id": staff.pk,
        "employee_id": staff.employee_id or "",
        "name": staff.name or "",
        "grade": staff.grade or "",
        "directorate": staff.directorate or "",
        "position": staff.position or "",
        "bank": staff.bank or "",
        "account": staff.account or "",
        "number": staff.number or "",
        "has_agent": has_agent,
    }


def search_staff_and_agents(raw_search: str) -> dict:
    """
    Batch Search Staff — fewer queries than legacy v2 loop.
    Returns staff payroll hits + matching agents + Create-Agent candidates.
    """
    terms = parse_search_terms(raw_search)
    if not terms:
        return {
            "exists": False,
            "message": "Please provide phone number or employee ID",
            "staff_data": [],
            "agents_data": [],
            "has_staff": False,
            "has_agents": False,
            "not_found_terms": [],
            "staff_needing_agent": [],
            "searched_count": 0,
            "found_terms_count": 0,
            "staff_terms_matched": 0,
            "agents_terms_matched": 0,
            "staff_without_agent_count": 0,
            "missing_from_staff_count": 0,
            "debug": {"search_terms": [], "source": "staff"},
        }

    staff_by_pk: dict[int, Staff] = {}
    agents_by_pk: dict[int, Agent] = {}
    not_found: list[str] = []
    agents_only_terms: list[dict] = []
    staff_terms_matched = 0
    agents_terms_matched = 0

    # Per-term matches (still batched per term; staff table is indexed).
    for term in terms:
        term_staff = list(staff_matches_term(term)[:40])
        term_agents = list(agents_matches_term(term)[:40])
        if not term_staff and not term_agents:
            not_found.append(term)
            continue
        if term_staff:
            staff_terms_matched += 1
        if term_agents:
            agents_terms_matched += 1
        if term_agents and not term_staff:
            agents_only_terms.append({
                "term": term,
                "agents": [
                    {
                        "service_id": a.service_id,
                        "name": a.personal_number,
                        "nickname": a.nickname,
                        "employee_id": (a.nickname or "").strip(),
                        "phone": a.phone,
                    }
                    for a in term_agents
                ],
            })
        for s in term_staff:
            staff_by_pk[s.pk] = s
        for a in term_agents:
            agents_by_pk[a.pk] = a

    staff_list_raw = list(staff_by_pk.values())

    # One query: which staff already have agents (by nickname/phone variants).
    nick_or_phone: set[str] = set()
    for s in staff_list_raw:
        eid = (s.employee_id or "").strip()
        phone = (s.number or "").strip()
        if eid:
            nick_or_phone |= exact_numeric_variants(eid) if eid.isdigit() else {eid}
            nick_or_phone.add(eid)
        if phone:
            nick_or_phone |= exact_numeric_variants(phone) if phone.isdigit() else {phone}
            nick_or_phone.add(phone)

    linked_agent_keys: set[str] = set()
    if nick_or_phone:
        linked = (
            Agent.objects.filter(Q(nickname__in=nick_or_phone) | Q(phone__in=nick_or_phone))
            .exclude(user__is_superuser=True)
            .select_related("user", "county")
            .prefetch_related(Prefetch("user__groups", queryset=Group.objects.only("id", "name")))
            .only(
                "id", "service_id", "personal_fullname", "nickname", "phone", "email",
                "county_id", "user_id", "first_name", "father_name", "last_name", "fourth_name",
            )
        )
        for a in linked:
            agents_by_pk[a.pk] = a
            if a.nickname:
                linked_agent_keys.add(a.nickname.strip())
            if a.phone:
                linked_agent_keys.add(a.phone.strip())

    def _staff_has_agent(s: Staff) -> bool:
        eid = (s.employee_id or "").strip()
        phone = (s.number or "").strip()
        candidates = set()
        if eid:
            candidates |= exact_numeric_variants(eid) if eid.isdigit() else {eid}
            candidates.add(eid)
        if phone:
            candidates |= exact_numeric_variants(phone) if phone.isdigit() else {phone}
            candidates.add(phone)
        return bool(candidates & linked_agent_keys)

    staff_data = [staff_to_dict(s, has_agent=_staff_has_agent(s)) for s in staff_list_raw]
    agents_data = [agent_to_search_dict(a) for a in agents_by_pk.values()]
    staff_needing_agent = [s for s in staff_data if not s["has_agent"]]

    has_staff = bool(staff_data)
    has_agents = bool(agents_data)
    searched_count = len(terms)

    if not has_staff and not has_agents:
        return {
            "exists": False,
            "message": "No staff or agents found with the provided criteria",
            "staff_data": [],
            "agents_data": [],
            "has_staff": False,
            "has_agents": False,
            "not_found_terms": not_found,
            "staff_needing_agent": [],
            "searched_count": searched_count,
            "found_terms_count": 0,
            "staff_terms_matched": 0,
            "agents_terms_matched": 0,
            "staff_without_agent_count": 0,
            "missing_from_staff_count": 0,
            "debug": {
                "search_terms": terms,
                "staff_count": 0,
                "agents_count": 0,
                "source": "staff",
            },
        }

    parts = []
    if searched_count:
        parts.append(f"{staff_terms_matched} of {searched_count} ID(s) in Staff payroll")
    if has_agents:
        parts.append(f"{len(agents_data)} agent record(s)")
    summary = " — ".join(parts)
    gaps = []
    if not_found:
        gaps.append(f"{len(not_found)} not in any database")
    if agents_only_terms:
        gaps.append(f"{len(agents_only_terms)} in Agents only (not Staff payroll)")
    if gaps:
        summary += f" — {'; '.join(gaps)}"

    return {
        "exists": True,
        "message": summary,
        "staff_data": staff_data,
        "agents_data": agents_data,
        "has_staff": has_staff,
        "has_agents": has_agents,
        "multiple": len(staff_data) + len(agents_data) > 1,
        "not_found_terms": not_found,
        "agents_only_terms": agents_only_terms,
        "staff_needing_agent": staff_needing_agent,
        "staff_without_agent_count": len(staff_needing_agent),
        "searched_count": searched_count,
        "staff_terms_matched": staff_terms_matched,
        "agents_terms_matched": agents_terms_matched,
        "missing_from_staff_count": len(staff_needing_agent),
        "found_terms_count": searched_count - len(not_found),
        "debug": {
            "search_terms": terms,
            "staff_count": len(staff_data),
            "agents_count": len(agents_data),
            "not_found_count": len(not_found),
            "agents_only_count": len(agents_only_terms),
            "source": "staff",
        },
    }
