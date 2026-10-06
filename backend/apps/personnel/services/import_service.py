"""Hierarchical Excel parser and reconciliation for agent roster imports."""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import openpyxl
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import Agent, County, Department, Staff
from apps.accounts.services.staff_search import exact_numeric_variants, staff_agent_lookup_q, staff_matches_term
from apps.personnel.models import AgentImportBatch, AgentImportRow, AgentStatus
from apps.personnel.services.operations import release_agent_from_section, transfer_agent

DISTRICT_RE = re.compile(r"^DEGMADA\s+(.+)$", re.I)
SUBGROUP_RE = re.compile(r"^KOOXDA\s+(.+)$", re.I)
UNIT_RE = re.compile(r"^UNUGTA\s+(.+)$", re.I)

DISTRICT_ALIASES = {
    "WADAJIR": "Wadajir",
    "DHARKINLEY": "Dharkanleey",
    "DHARKINLE": "Dharkanleey",
    "DHARKIINLEY": "Dharkanleey",
    "DHARKIINLE": "Dharkanleey",
    "KAXDA": "Kaxda",
    "HODAN": "Hodan",
    "H0WLWADAAG": "Howlwadaag",
    "HAWLWADAAG": "Howlwadaag",
    "HOWLWADAAG": "Howlwadaag",
    "HOLWADAAG": "Howlwadaag",
    "XAMAR JAJAB": "Xamarjajab",
    "XAMARJAJAB": "Xamarjajab",
    "WAABERI": "Waaberi",
    "WAABARI": "Waaberi",
    "LABISAN": "Labisan",
    "YAQSHID": "Yaaqshiid",
    "YAQSHIID": "Yaaqshiid",
    "YAAQSHID": "Yaaqshiid",
    "YAAQSHIID": "Yaaqshiid",
    "GUBUDLEY": "Gubadley",
    "GUBADLEY": "Gubadley",
}

SECTION_FROM_FILENAME = {
    "galbeed sare": "Qeybta Galbeed Sare",
    "galbeed": "Qeybta Galbeed",
    "waliyow": "Qeybta Waliyow Cadde",
    "walliyow": "Qeybta Waliyow Cadde",
    "bartamaha": "Qeybta Bartamaha",
    "bari": "Qeybta Bari",
}

DEPARTMENT_ALIASES = {
    "QEEBTA WALIYOOW CADDE": "Qeybta Waliyow Cadde",
    "QEEBTA WALIYOW CADDE": "Qeybta Waliyow Cadde",
    "QEYTA GALBEED": "Qeybta Galbeed",
    "QEEBTA GALBEED": "Qeybta Galbeed",
}

STATUS_MAP = {
    "active": "ACTIVE",
    "badal": "TRANSFERRED",
    "lama haayo": "ABSENT",
    "xabsi": "ARRESTED",
    "kama": "ABSENT",
}

STATUS2_MAP = {
    "dhaawac": "INJURED",
    "xanuun qaliin": "INJURED",
    "fakad": "ABSCONDED",
    "lama haayo": "ABSENT",
    "xabsiga dhexe": "ARRESTED",
    "bil fasax": "ON_LEAVE",
    "tahariib liibiya": "ABSCONDED",
    "hubin": "ACTIVE",
}


class ImportParseError(Exception):
    pass


@dataclass
class ParsedAgentRow:
    row_number: int
    service_id: str
    name: str
    position: str = ""
    weapon_name: str = ""
    phone: str = ""
    serial_number: str = ""
    status: str = ""
    status_note: str = ""
    district_raw: str | None = None
    district_normalized: str | None = None
    department_name: str = ""
    team_name: str = ""
    unit_name: str = ""
    is_labisin: bool = False
    source_file: str = ""


SECTION_HQ_NOTE = "Section headquarters (listed before any DEGMADA header in Excel)"

PREVIEW_ROW_LIMIT = 1000


@dataclass
class ImportSummary:
    total_rows: int = 0
    new_agents: int = 0
    existing_agents: int = 0
    district_changes: int = 0
    duplicate_records: int = 0
    invalid_records: int = 0
    missing_from_excel: int = 0
    additional_in_excel: int = 0
    section_db_total: int = 0
    matched_in_section: int = 0
    matched_outside_section: int = 0
    conflicts: int = 0
    ready_to_apply: bool = False
    dry_run: bool = True
    source_section: str = ""
    errors: list[str] = field(default_factory=list)
    changes_preview: list[dict] = field(default_factory=list)
    missing_preview: list[dict] = field(default_factory=list)
    district_breakdown: dict[str, int] = field(default_factory=dict)
    section_hq_count: int = 0
    released_from_section: int = 0


def detect_section_from_filename(filename: str) -> str:
    lower = filename.lower()
    for key, name in SECTION_FROM_FILENAME.items():
        if key in lower:
            return name
    return ""


def normalize_district_name(raw: str | None) -> str | None:
    if not raw:
        return None
    name = re.sub(r"^DEGMADA\s+", "", raw.strip(), flags=re.I)
    name = re.sub(r"\s+LABISAN$", "", name, flags=re.I).strip()
    upper = name.upper()
    return DISTRICT_ALIASES.get(upper, name.title())


def parse_agent_roster_xlsx(fileobj, *, filename: str = "") -> list[ParsedAgentRow]:
    wb = openpyxl.load_workbook(fileobj, read_only=True, data_only=True)
    ws = wb.active
    department_name = detect_section_from_filename(filename)
    current_district: str | None = None
    current_team = ""
    current_unit = ""
    is_labisin = False
    rows: list[ParsedAgentRow] = []

    for idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
        if not row:
            continue
        first = row[0]
        if isinstance(first, str):
            text = first.strip()
            if DISTRICT_RE.match(text):
                current_district = text
                is_labisin = "LABISAN" in text.upper()
                current_team = ""
                current_unit = ""
                continue
            if SUBGROUP_RE.match(text):
                current_team = text
                current_unit = ""
                continue
            if UNIT_RE.match(text):
                current_unit = text
                continue
            if text.lower() in ("no",):
                continue

        try:
            int(first)
        except (ValueError, TypeError):
            continue

        emp_no = row[1] if len(row) > 1 else None
        if emp_no is None:
            continue

        service_id = str(emp_no).strip()
        if not service_id or not re.match(r"^\d+$", service_id):
            continue

        rows.append(
            ParsedAgentRow(
                row_number=idx,
                service_id=service_id,
                name=str(row[2]).strip() if len(row) > 2 and row[2] else "",
                position=str(row[3]).strip() if len(row) > 3 and row[3] else "",
                weapon_name=str(row[4]).strip() if len(row) > 4 and row[4] else "",
                phone=str(row[5]).strip() if len(row) > 5 and row[5] else "",
                serial_number=str(row[6]).strip() if len(row) > 6 and row[6] else "",
                status=str(row[7]).strip().lower() if len(row) > 7 and row[7] else "",
                status_note=str(row[8]).strip().lower() if len(row) > 8 and row[8] else "",
                district_raw=current_district,
                district_normalized=normalize_district_name(current_district),
                department_name=department_name,
                team_name=current_team,
                unit_name=current_unit,
                is_labisin=is_labisin,
                source_file=filename,
            )
        )

    wb.close()
    return rows


def _resolve_county(name: str | None) -> County | None:
    if not name or name.lower() == "labisan":
        return None
    canonical = normalize_district_name(name) or name
    county = County.objects.filter(name__iexact=canonical).first()
    if county:
        return county
    return County.objects.filter(name__icontains=canonical[:6]).first()


def _normalize_department_name(name: str) -> str:
    key = re.sub(r"\s+", " ", (name or "").strip()).upper()
    return DEPARTMENT_ALIASES.get(key, name.strip())


def _resolve_department(name: str) -> Department | None:
    if not name:
        return None
    canonical = _normalize_department_name(name)
    dept = Department.objects.filter(name__iexact=canonical).first()
    if dept:
        return dept
    dept = Department.objects.filter(name__iexact=name).first()
    if dept:
        return dept
    return Department.objects.filter(name__icontains=name.split()[-1]).first()


def _resolve_status_code(row: ParsedAgentRow) -> str:
    if row.status in STATUS_MAP:
        return STATUS_MAP[row.status]
    if row.status_note in STATUS2_MAP:
        return STATUS2_MAP[row.status_note]
    if row.status_note and row.status_note not in ("ok", "oki", ""):
        if "badal" in row.status_note:
            return "TRANSFERRED"
        if "xabsi" in row.status_note:
            return "ARRESTED"
        if "dhaawac" in row.status_note or "xanuun" in row.status_note:
            return "INJURED"
        if "fakad" in row.status_note or "tahariib" in row.status_note:
            return "ABSCONDED"
        if "fasax" in row.status_note:
            return "ON_LEAVE"
    return "ACTIVE"


def normalize_service_id(service_id: str | None) -> str:
    raw = str(service_id or "").strip()
    if raw.isdigit():
        return raw.lstrip("0") or "0"
    return raw


def normalize_phone(phone: str | None) -> str:
    digits = re.sub(r"\D", "", str(phone or ""))
    if digits.startswith("252") and len(digits) > 9:
        digits = digits[3:]
    if digits.startswith("0") and len(digits) > 9:
        digits = digits[1:]
    return digits[-9:] if len(digits) >= 9 else digits


def storage_phone(phone: str | None) -> str:
    """Canonical phone string for Agent.phone unique field."""
    normalized = normalize_phone(phone)
    return normalized or str(phone or "").strip()


def phone_owner(phone: str | None, *, exclude_pk: int | None = None) -> Agent | None:
    target = storage_phone(phone)
    if not target:
        return None
    qs = Agent.objects.filter(is_archived=False).exclude(phone="")
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    for agent in qs.only("pk", "phone", "service_id", "nickname", "personal_fullname", "first_name", "father_name", "last_name"):
        if normalize_phone(agent.phone) == target:
            return agent
    raw = str(phone or "").strip()
    if raw:
        return qs.filter(phone=raw).first()
    return None


def normalize_person_name(name: str | None) -> str:
    if not name:
        return ""
    cleaned = re.sub(r"\s+", " ", str(name).strip().lower())
    return cleaned


@dataclass
class AgentMatchResult:
    agent: Agent | None = None
    method: str = ""
    errors: list[str] = field(default_factory=list)
    conflict_agents: list[dict] = field(default_factory=list)


def agent_conflict_dict(agent: Agent, match_method: str) -> dict:
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


MATCH_PRIORITY = (
    "service_id",
    "service_id_normalized",
    "phone",
    "nickname",
    "staff_payroll",
    "name",
)


@dataclass
class AgentLookup:
    by_service_id: dict[str, Agent]
    by_service_id_norm: dict[str, Agent]
    by_phone: dict[str, Agent]
    by_nickname: dict[str, Agent]
    by_name: dict[str, Agent]


def emp_no_variants(value: str | None) -> set[str]:
    raw = str(value or "").strip()
    if not raw:
        return set()
    if raw.isdigit():
        variants = set(exact_numeric_variants(raw))
        stripped = raw.lstrip("0") or "0"
        if not raw.startswith("0"):
            variants.add(f"0{stripped}")
        return {v for v in variants if v}
    return {raw}


def agent_display_name(agent: Agent) -> str:
    if agent.personal_fullname:
        return normalize_person_name(agent.personal_fullname)
    parts = [agent.first_name, agent.father_name, agent.last_name, agent.fourth_name]
    return normalize_person_name(" ".join(part for part in parts if part))


def phone_assignment_error(
    agent: Agent | None,
    phone: str | None,
    lookup: AgentLookup | None = None,
) -> str | None:
    if not agent or not phone:
        return None
    target = storage_phone(phone)
    if not target:
        return None
    if normalize_phone(agent.phone) == target:
        return None
    owner = lookup.by_phone.get(target) if lookup else None
    if not owner or owner.pk == agent.pk:
        owner = phone_owner(phone, exclude_pk=agent.pk)
    if owner and owner.pk != agent.pk:
        label = owner.service_id or owner.nickname or owner.pk
        name = owner.personal_fullname or agent_display_name(owner) or ""
        suffix = f" ({name})" if name else ""
        return (
            f"Phone {phone} is already used by Emp No {label}{suffix}. "
            "Merge the records or fix the Excel row."
        )
    return None


def _assign_phone_safely(agent: Agent, phone: str) -> None:
    err = phone_assignment_error(agent, phone)
    if err:
        raise ImportParseError(err)
    stored = storage_phone(phone)
    if stored:
        agent.phone = stored


def agent_matches_excel_emp_no(agent: Agent, emp_no: str) -> bool:
    """True when this agent is already tied to the Excel Emp No (payroll identity)."""
    sid_variants = emp_no_variants(emp_no)
    service_id = str(agent.service_id or "").strip()
    nickname = str(agent.nickname or "").strip()
    if service_id and service_id in sid_variants:
        return True
    if nickname and nickname in sid_variants:
        return True
    if service_id and normalize_service_id(service_id) in {normalize_service_id(v) for v in sid_variants}:
        return True
    return False


def _agents_for_staff(staff: Staff) -> list[Agent]:
    lookup_q = staff_agent_lookup_q(staff)
    if not lookup_q:
        return []
    return list(
        Agent.objects.filter(lookup_q, is_archived=False).select_related("county", "department")[:5]
    )


def _staff_matches_emp_no(staff: Staff, emp_no: str) -> bool:
    staff_id = str(staff.employee_id or "").strip()
    if not staff_id or not emp_no:
        return False
    return staff_id in emp_no_variants(emp_no) or staff_id == emp_no


def _find_agent_via_staff(emp_no: str, phone: str = "") -> AgentMatchResult:
    """Resolve agent through payroll Staff rows — Emp No first, phone only as fallback."""
    result = AgentMatchResult()
    emp_no = str(emp_no or "").strip()

    if emp_no:
        staff_rows = list(staff_matches_term(emp_no)[:5])
        exact_staff = [staff for staff in staff_rows if _staff_matches_emp_no(staff, emp_no)]
        if not exact_staff:
            exact_staff = staff_rows

        agents: list[Agent] = []
        seen: set[int] = set()
        for staff in exact_staff:
            for agent in _agents_for_staff(staff):
                if agent.pk not in seen:
                    seen.add(agent.pk)
                    agents.append(agent)

        if len(agents) == 1:
            result.agent = agents[0]
            result.method = "staff_payroll"
            return result
        if len(agents) > 1:
            result.errors.append(
                f"Multiple agents linked to payroll Emp No {emp_no}: {', '.join(str(a.pk) for a in agents[:4])}."
            )
            result.conflict_agents = [agent_conflict_dict(agent, "staff_payroll") for agent in agents]
            return result

    phone_term = str(phone or "").strip()
    if phone_term:
        staff_rows = list(staff_matches_term(phone_term)[:3])
        agents = []
        seen = set()
        for staff in staff_rows:
            for agent in _agents_for_staff(staff):
                if agent.pk not in seen:
                    seen.add(agent.pk)
                    agents.append(agent)
        if len(agents) == 1:
            result.agent = agents[0]
            result.method = "staff_payroll"
            return result
        if len(agents) > 1:
            result.errors.append(
                f"Multiple agents linked to payroll phone {phone_term}: {', '.join(str(a.pk) for a in agents[:4])}."
            )
            result.conflict_agents = [agent_conflict_dict(agent, "staff_payroll") for agent in agents]
            return result

    return result


def build_agent_lookup() -> AgentLookup:
    by_service_id: dict[str, Agent] = {}
    by_service_id_norm: dict[str, Agent] = {}
    by_phone: dict[str, Agent] = {}
    by_nickname: dict[str, Agent] = {}
    by_name: dict[str, Agent] = {}
    qs = Agent.objects.filter(is_archived=False).select_related("county", "department")
    for agent in qs:
        if agent.service_id:
            sid = str(agent.service_id).strip()
            by_service_id[sid] = agent
            norm = normalize_service_id(sid)
            if norm and norm not in by_service_id_norm:
                by_service_id_norm[norm] = agent
        phone = normalize_phone(agent.phone)
        if phone and phone not in by_phone:
            by_phone[phone] = agent
        if agent.nickname:
            for variant in emp_no_variants(str(agent.nickname).strip()):
                if variant not in by_nickname:
                    by_nickname[variant] = agent
        fullname = agent_display_name(agent)
        if fullname and fullname not in by_name:
            by_name[fullname] = agent
    return AgentLookup(
        by_service_id=by_service_id,
        by_service_id_norm=by_service_id_norm,
        by_phone=by_phone,
        by_nickname=by_nickname,
        by_name=by_name,
    )


def find_existing_agent(row: ParsedAgentRow, lookup: AgentLookup) -> AgentMatchResult:
    """Match Excel row to DB agent by Emp No, phone, nickname, payroll, or name."""
    result = AgentMatchResult()
    sid = str(row.service_id).strip()
    phone = normalize_phone(row.phone)
    name_key = normalize_person_name(row.name)

    candidates: list[tuple[str, Agent]] = []
    if sid in lookup.by_service_id:
        candidates.append(("service_id", lookup.by_service_id[sid]))
    norm = normalize_service_id(sid)
    if norm in lookup.by_service_id_norm:
        candidates.append(("service_id_normalized", lookup.by_service_id_norm[norm]))
    if phone and phone in lookup.by_phone:
        candidates.append(("phone", lookup.by_phone[phone]))
    for variant in emp_no_variants(sid):
        if variant in lookup.by_nickname:
            candidates.append(("nickname", lookup.by_nickname[variant]))
    if name_key and name_key in lookup.by_name:
        candidates.append(("name", lookup.by_name[name_key]))

    staff_match = _find_agent_via_staff(sid, row.phone)
    if staff_match.agent:
        candidates.append((staff_match.method, staff_match.agent))
    elif staff_match.conflict_agents and not candidates:
        result.errors.extend(staff_match.errors)
        result.conflict_agents = staff_match.conflict_agents
        return result

    if not candidates:
        return result

    # Excel Emp No is authoritative — ignore phone/name matches to a different person.
    emp_id_matches = [(method, agent) for method, agent in candidates if agent_matches_excel_emp_no(agent, sid)]
    if emp_id_matches:
        emp_id_matches.sort(key=lambda item: MATCH_PRIORITY.index(item[0]))
        result.agent = emp_id_matches[0][1]
        result.method = emp_id_matches[0][0]
        return result

    candidates.sort(key=lambda item: MATCH_PRIORITY.index(item[0]))
    primary_method, primary_agent = candidates[0]
    conflict_agents: list[dict] = []
    seen_ids: set[int] = set()
    for method, agent in candidates:
        if agent.pk in seen_ids:
            continue
        seen_ids.add(agent.pk)
        conflict_agents.append(agent_conflict_dict(agent, method))

    for method, agent in candidates[1:]:
        if agent.pk != primary_agent.pk:
            result.errors.append(
                f"Conflicting DB matches: {primary_method} (pk {primary_agent.pk}) "
                f"vs {method} (pk {agent.pk}) for Emp No {sid}."
            )
            result.conflict_agents = conflict_agents
            return result

    result.agent = primary_agent
    result.method = primary_method
    return result


def get_section_agents(department: Department):
    county_ids = list(department.counties.values_list("id", flat=True))
    return (
        Agent.objects.filter(is_archived=False)
        .filter(Q(department_id=department.id) | Q(county_id__in=county_ids))
        .select_related("county", "department")
    )


def agent_missing_dict(agent: Agent) -> dict:
    return {
        "service_id": agent.service_id or "",
        "name": agent.personal_fullname or str(agent),
        "phone": agent.phone or "",
        "nickname": agent.nickname or "",
        "district": agent.county.name if agent.county_id else None,
        "department": agent.department.name if agent.department_id else None,
        "action": "remove_from_section",
    }


def classify_existing_agent(
    agent: Agent,
    row: ParsedAgentRow,
    *,
    county: County | None,
    department: Department | None,
    match_method: str,
    diff: dict,
) -> AgentImportRow.Action:
    action = AgentImportRow.Action.UPDATE
    old_sid = str(agent.service_id or "").strip()
    new_sid = str(row.service_id).strip()
    if match_method != "service_id" and normalize_service_id(old_sid) != normalize_service_id(new_sid):
        diff["old_service_id"] = old_sid or None
        diff["new_service_id"] = new_sid

    old_county = agent.county.name if agent.county_id else None
    new_county = county.name if county else None
    old_dept = agent.department.name if agent.department_id else None
    new_dept = (department.name if department else None) or row.department_name or None

    county_will_change = bool(county and agent.county_id != county.id)
    dept_will_change = bool(department and agent.department_id != department.id)
    was_released = not agent.department_id and not agent.county_id

    if county_will_change or dept_will_change:
        action = AgentImportRow.Action.TRANSFER
        if county_will_change:
            diff["old_district"] = old_county
            diff["new_district"] = new_county
        if dept_will_change:
            diff["old_department"] = old_dept
            diff["new_department"] = new_dept
        if was_released:
            diff["previously_released"] = True
        elif old_dept and new_dept and old_dept != new_dept:
            diff["from_other_section"] = True

    if agent.personal_fullname and normalize_person_name(agent.personal_fullname) != normalize_person_name(row.name):
        diff["old_name"] = agent.personal_fullname
        diff["new_name"] = row.name

    if row.phone and normalize_phone(agent.phone) != normalize_phone(row.phone):
        diff["old_phone"] = agent.phone
        diff["new_phone"] = row.phone

    if agent.nickname and normalize_person_name(agent.nickname) == normalize_person_name(row.name):
        diff["matched_nickname"] = agent.nickname

    diff["match_method"] = match_method

    return action


def _resolve_transfer_destination(
    agent: Agent,
    county: County | None,
    department: Department | None,
) -> tuple[County | None, Department | None]:
    """Pick county/department for transfer history when Excel row has no district."""
    if county:
        return county, department or agent.department
    if agent.county_id:
        return agent.county, department or agent.department
    if department:
        linked = department.counties.order_by("name").first()
        if linked:
            return linked, department
    return None, department or agent.department


def _sync_payroll_identity(agent: Agent, row: ParsedAgentRow, *, match_method: str) -> None:
    """Attach Excel Emp No and payroll nickname when the matched record uses legacy IDs."""
    new_sid = str(row.service_id).strip()
    if not new_sid:
        return
    current = str(agent.service_id or "").strip()
    if current != new_sid:
        if Agent.objects.filter(service_id=new_sid).exclude(pk=agent.pk).exists():
            raise ImportParseError(f"Emp No {new_sid} is already assigned to another agent.")
        agent.service_id = new_sid
    if match_method in {"phone", "staff_payroll", "name", "nickname", "service_id_normalized"}:
        nick = (agent.nickname or "").strip()
        if not nick or nick.isdigit():
            agent.nickname = new_sid


def reconcile_rows(parsed_rows: list[ParsedAgentRow], *, department_scope: str = "") -> ImportSummary:
    summary = ImportSummary(
        total_rows=len(parsed_rows),
        source_section=department_scope or (parsed_rows[0].department_name if parsed_rows else ""),
        dry_run=True,
    )

    by_service_id: dict[str, list[ParsedAgentRow]] = defaultdict(list)
    for row in parsed_rows:
        by_service_id[row.service_id].append(row)

    duplicates = {sid: items for sid, items in by_service_id.items() if len(items) > 1}
    summary.duplicate_records = sum(len(v) - 1 for v in duplicates.values())
    summary.conflicts = 0

    existing_agents = build_agent_lookup()
    matched_agent_ids: set[int] = set()
    section_agent_ids: set[int] = set()
    section_department = None
    if department_scope:
        section_department = _resolve_department(department_scope)
        if section_department:
            section_agent_ids = {a.pk for a in get_section_agents(section_department)}

    for service_id, items in by_service_id.items():
        row = items[-1]  # last occurrence wins but flag conflicts
        county = _resolve_county(row.district_normalized)
        department = _resolve_department(department_scope) or _resolve_department(row.department_name)
        status_code = _resolve_status_code(row)
        errors: list[str] = []

        if len(items) > 1:
            districts = {i.district_normalized for i in items}
            unique_districts = {d for d in districts if d}
            if len(unique_districts) > 1:
                errors.append(
                    f"Duplicate Emp No in file across districts: {', '.join(sorted(unique_districts))}"
                )
                summary.conflicts += 1
            else:
                errors.append(f"Duplicate Emp No in file (using last row): {service_id}")

        if row.district_normalized and not county and row.district_normalized.lower() != "labisan":
            errors.append(f"Unknown district: {row.district_normalized}")
            summary.invalid_records += 1

        if not row.name:
            errors.append("Missing agent name")
            summary.invalid_records += 1

        match = find_existing_agent(row, existing_agents)
        if match.errors:
            errors.extend(match.errors)

        agent = match.agent
        match_method = match.method
        phone_conflict_agents: list[dict] = []

        if agent and row.phone:
            phone_err = phone_assignment_error(agent, row.phone, existing_agents)
            if phone_err:
                errors.append(phone_err)
                owner = phone_owner(row.phone, exclude_pk=agent.pk)
                if owner:
                    phone_conflict_agents = [
                        agent_conflict_dict(agent, match_method or "excel"),
                        agent_conflict_dict(owner, "phone"),
                    ]
                summary.conflicts += 1
        elif not agent and row.phone and phone_owner(row.phone):
            owner = phone_owner(row.phone)
            phone_err = (
                f"Phone {row.phone} is already used by Emp No {owner.service_id or owner.nickname or owner.pk}. "
                "This row should update that agent, not create a duplicate."
            )
            errors.append(phone_err)
            summary.conflicts += 1

        diff: dict = {
            "service_id": service_id,
            "name": row.name,
            "phone": row.phone,
            "district": row.district_normalized,
            "department": row.department_name,
            "status_code": status_code,
            "position": row.position,
            "team_name": row.team_name,
            "unit_name": row.unit_name,
            "is_labisin": row.is_labisin,
        }
        if match.conflict_agents:
            diff["conflict_agents"] = match.conflict_agents
        elif phone_conflict_agents:
            diff["conflict_agents"] = phone_conflict_agents
        if not row.district_normalized and not row.is_labisin:
            diff["section_hq"] = True
            summary.section_hq_count += 1

        if agent:
            matched_agent_ids.add(agent.pk)
            summary.existing_agents += 1
            if section_department and agent.pk not in section_agent_ids:
                summary.matched_outside_section += 1
            action = classify_existing_agent(
                agent,
                row,
                county=county,
                department=department,
                match_method=match_method,
                diff=diff,
            )
            if action == AgentImportRow.Action.TRANSFER:
                summary.district_changes += 1
        else:
            summary.new_agents += 1
            summary.additional_in_excel += 1
            action = AgentImportRow.Action.CREATE

        if errors:
            if match.conflict_agents or phone_conflict_agents:
                action = AgentImportRow.Action.CONFLICT
                if not summary.conflicts:
                    summary.conflicts += 1
            elif len(items) > 1 and summary.conflicts:
                action = AgentImportRow.Action.CONFLICT
            else:
                action = AgentImportRow.Action.ERROR

        action_value = action.value if hasattr(action, "value") else str(action)
        summary.changes_preview.append({
            "service_id": service_id,
            "name": row.name,
            "action": action_value,
            "errors": errors,
            "diff": diff,
        })

        district_key = row.district_normalized or ("Labisan" if row.is_labisin else "Section HQ")
        summary.district_breakdown[district_key] = summary.district_breakdown.get(district_key, 0) + 1

    if department_scope and section_agent_ids:
        section_agents = [a for a in Agent.objects.filter(pk__in=section_agent_ids).select_related("county", "department")]
        summary.section_db_total = len(section_agents)
        summary.matched_in_section = len(section_agent_ids & matched_agent_ids)
        missing_agents = [a for a in section_agents if a.pk not in matched_agent_ids]
        summary.missing_from_excel = len(missing_agents)
        summary.released_from_section = len(missing_agents)
        summary.missing_preview = [agent_missing_dict(a) for a in missing_agents[:PREVIEW_ROW_LIMIT]]

    summary.ready_to_apply = summary.invalid_records == 0 and summary.conflicts == 0
    return summary


def _apply_agent_fields(agent: Agent, row: ParsedAgentRow, *, agent_status, status_code: str, department) -> None:
    """Update agent profile fields from a parsed import row."""
    agent.personal_fullname = row.name
    if row.phone:
        _assign_phone_safely(agent, row.phone)
    if department:
        agent.department = department
    if row.weapon_name:
        agent.weapon_name = row.weapon_name
    if row.serial_number:
        agent.serial_number = row.serial_number
    agent.position_title = row.position
    agent.team_name = row.team_name
    agent.unit_name = row.unit_name
    agent.is_labisin = row.is_labisin
    agent.notes = row.status_note or ""
    if agent_status:
        agent.agent_status = agent_status
    agent.status = "Active" if status_code == "ACTIVE" else status_code.title()


def import_agent_roster(
    fileobj,
    *,
    user,
    filename: str = "",
    dry_run: bool = True,
    department_scope: str = "",
) -> dict:
    parsed = parse_agent_roster_xlsx(fileobj, filename=filename)
    if not parsed:
        raise ImportParseError("No agent rows found in the uploaded file.")

    section = department_scope or detect_section_from_filename(filename) or parsed[0].department_name
    summary = reconcile_rows(parsed, department_scope=section)

    if dry_run:
        preview_total = len(summary.changes_preview)
        preview_shown = min(preview_total, PREVIEW_ROW_LIMIT)
        return {
            "dry_run": True,
            "total_rows": summary.total_rows,
            "new_agents": summary.new_agents,
            "existing_agents": summary.existing_agents,
            "district_changes": summary.district_changes,
            "duplicate_records": summary.duplicate_records,
            "invalid_records": summary.invalid_records,
            "missing_from_excel": summary.missing_from_excel,
            "additional_in_excel": summary.additional_in_excel,
            "section_db_total": summary.section_db_total,
            "matched_in_section": summary.matched_in_section,
            "matched_outside_section": summary.matched_outside_section,
            "conflicts": summary.conflicts,
            "ready_to_apply": summary.ready_to_apply,
            "source_section": section,
            "district_breakdown": summary.district_breakdown,
            "section_hq_count": summary.section_hq_count,
            "released_from_section": summary.released_from_section,
            "missing_preview": summary.missing_preview[:PREVIEW_ROW_LIMIT],
            "preview_total": preview_total,
            "preview_shown": preview_shown,
            "preview_truncated": preview_shown < preview_total,
            "changes_preview": summary.changes_preview[:PREVIEW_ROW_LIMIT],
        }

    if not summary.ready_to_apply:
        raise ImportParseError("Import has validation errors or conflicts. Review the preview before applying.")

    try:
        with transaction.atomic():
            return _apply_import_batch(
                parsed=parsed,
                section=section,
                filename=filename,
                user=user,
            )
    except IntegrityError as exc:
        message = str(exc)
        if "agents_phone_key" in message:
            raise ImportParseError(
                "An agent phone number in this import is already used by another record. "
                "Preview the import again, resolve phone conflicts with Merge, then apply."
            ) from exc
        raise ImportParseError(f"Import failed due to a database constraint: {message}") from exc


def _apply_import_batch(*, parsed, section: str, filename: str, user) -> dict:
    batch = AgentImportBatch.objects.create(
        filename=filename or "upload.xlsx",
        source_section=section,
        status=AgentImportBatch.Status.APPLIED,
        uploaded_by=user,
        applied_at=timezone.now(),
    )
    created = updated = transferred = released = skipped = errors = 0
    matched_agent_ids: set[int] = set()
    section_department = _resolve_department(section)
    section_county_ids: set[int] = set()
    if section_department:
        section_county_ids = set(section_department.counties.values_list("id", flat=True))

    by_service_id: dict[str, ParsedAgentRow] = {}
    for row in parsed:
        by_service_id[row.service_id] = row

    lookup = build_agent_lookup()

    for service_id, row in by_service_id.items():
        county = _resolve_county(row.district_normalized)
        department = _resolve_department(section) or _resolve_department(row.department_name)
        status_code = _resolve_status_code(row)
        agent_status = AgentStatus.objects.filter(code=status_code).first()

        match = find_existing_agent(row, lookup)
        if match.errors:
            raise ImportParseError(match.errors[0])
        agent = match.agent
        match_method = match.method
        action = AgentImportRow.Action.CREATE
        diff: dict = {
            "service_id": service_id,
            "name": row.name,
            "district": row.district_normalized,
            "department": row.department_name,
            "position": row.position,
        }

        if agent:
            phone_err = phone_assignment_error(agent, row.phone, lookup)
            if phone_err:
                raise ImportParseError(f"Emp No {service_id}: {phone_err}")
            action = classify_existing_agent(
                agent,
                row,
                county=county,
                department=department,
                match_method=match_method,
                diff=diff,
            )
            if action == AgentImportRow.Action.TRANSFER:
                to_county, to_department = _resolve_transfer_destination(agent, county, department)
                if to_county:
                    transfer_agent(
                        agent=agent,
                        to_county=to_county,
                        to_department=to_department,
                        reason=f"Excel import ({section})",
                        transfer_date=timezone.now().date(),
                        performed_by=user,
                        notes=f"Transferred via roster import: {filename}",
                        skip_scope_check=True,
                    )
                else:
                    if to_department:
                        agent.department = to_department
                    if county:
                        agent.county = county
                    agent.save(update_fields=["county", "department", "updated_at"])
                transferred += 1
            else:
                updated += 1
            _sync_payroll_identity(agent, row, match_method=match_method)
            _apply_agent_fields(agent, row, agent_status=agent_status, status_code=status_code, department=department)
            if county and action != AgentImportRow.Action.TRANSFER:
                agent.county = county
            agent.save()
            matched_agent_ids.add(agent.pk)
        else:
            if row.phone and phone_owner(row.phone):
                owner = phone_owner(row.phone)
                label = owner.service_id or owner.nickname or owner.pk
                raise ImportParseError(
                    f"Emp No {service_id}: phone {row.phone} is already used by Emp No {label}."
                )
            parts = row.name.split()
            agent = Agent(
                service_id=service_id,
                first_name=parts[0] if parts else row.name,
                father_name=parts[1] if len(parts) > 1 else "",
                last_name=parts[2] if len(parts) > 2 else "",
                fourth_name=parts[3] if len(parts) > 3 else "",
                mother_name="",
                date_of_birth="",
                phone=storage_phone(row.phone) or f"imp{service_id[-9:]}",
                recorded_by=user,
            )
            if county:
                agent.county = county
            _apply_agent_fields(agent, row, agent_status=agent_status, status_code=status_code, department=department)
            agent.save()
            created += 1
            matched_agent_ids.add(agent.pk)

        AgentImportRow.objects.create(
            batch=batch,
            row_number=row.row_number,
            service_id=service_id,
            agent_name=row.name,
            action=action,
            diff=diff,
            raw_data={
                "district": row.district_normalized,
                "department": row.department_name,
                "status": row.status,
                "status_note": row.status_note,
            },
            agent=agent,
        )

    if section_department and section_county_ids:
        section_agent_ids = {a.pk for a in get_section_agents(section_department)}
        release_ids = section_agent_ids - matched_agent_ids
        for agent in Agent.objects.filter(pk__in=release_ids, is_archived=False).select_related("county", "department"):
            history = release_agent_from_section(
                agent=agent,
                section_department=section_department,
                section_county_ids=section_county_ids,
                reason=f"Not in Excel roster ({section})",
                transfer_date=timezone.now().date(),
                performed_by=user,
                notes=f"Released from section via roster import: {filename}",
            )
            if history:
                released += 1
                AgentImportRow.objects.create(
                    batch=batch,
                    row_number=0,
                    service_id=agent.service_id or agent.nickname or "",
                    agent_name=agent.personal_fullname or str(agent),
                    action=AgentImportRow.Action.REMOVE_FROM_SECTION,
                    diff={
                        "old_district": history.from_county.name if history.from_county_id else None,
                        "old_department": history.from_department.name if history.from_department_id else None,
                    },
                    raw_data={"reason": "not_in_excel"},
                    agent=agent,
                )

    batch.summary = {
        "created": created,
        "updated": updated,
        "transferred": transferred,
        "released": released,
        "skipped": skipped,
        "errors": errors,
        "total_rows": len(parsed),
    }
    batch.save(update_fields=["summary"])

    return {
        "dry_run": False,
        "batch_id": batch.pk,
        **batch.summary,
        "source_section": section,
    }
