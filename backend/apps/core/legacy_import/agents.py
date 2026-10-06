"""Import legacy `agents` rows (no integer `id` in MySQL dump — assign sequential ids)."""

from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from pathlib import Path

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone

from apps.accounts.models import Agent, County, Directorate, User
from apps.core.legacy_import.sql_dump import load_sql_file, parse_insert_rows
from apps.core.legacy_import.timestamps import bulk_create_preserving_timestamps


def _split_dir() -> Path:
    return Path(settings.BASE_DIR) / "data" / "split"


def _parse_dt(value):
    if value in (None, "", "NULL"):
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip()
        dt = None
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
        if dt is None:
            return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, dt_timezone.utc)
    return dt


def _lookup(filename: str, table: str, key_col: str, name_col: str) -> dict[int, str]:
    path = _split_dir() / filename
    if not path.is_file():
        return {}
    rows = parse_insert_rows(load_sql_file(str(path)), table)
    out: dict[int, str] = {}
    for r in rows:
        if r.get(key_col) in (None, ""):
            continue
        try:
            out[int(r[key_col])] = str(r.get(name_col) or "")
        except (TypeError, ValueError):
            continue
    return out


def _text(row: dict, key: str, max_len: int | None = None) -> str:
    v = row.get(key)
    s = "" if v in (None, "NULL") else str(v).strip()
    return s[:max_len] if max_len else s


def _fk(row: dict, key: str, valid: set[int]) -> int | None:
    v = row.get(key)
    try:
        pk = int(v)
    except (TypeError, ValueError):
        return None
    return pk if pk in valid else None


def _named(row: dict, key: str, table: dict[int, str]) -> str:
    v = row.get(key)
    try:
        return table.get(int(v), "")[:200]
    except (TypeError, ValueError):
        return ""


def import_agents(rows: list[dict], *, truncate: bool = False, batch_size: int = 200) -> dict:
    if truncate:
        with connection.cursor() as c:
            c.execute('TRUNCATE "agents" CASCADE')

    tribes = _lookup("tribes.sql", "tribes", "tribe_id", "tribe_name")
    regions = _lookup("region.sql", "region", "region_id", "region_name")
    if not regions:
        regions = _lookup("regions.sql", "regions", "id", "name")
    sub_counties = _lookup("sub_county.sql", "sub_county", "sub_county_id", "sub_county_name")
    sections = _lookup("people_section.sql", "people_section", "section_id", "section_name")

    valid_users = set(User.objects.values_list("pk", flat=True))
    valid_counties = set(County.objects.values_list("pk", flat=True))
    valid_directorates = set(Directorate.objects.values_list("pk", flat=True))

    batch_size = max(50, batch_size)
    seen_phones: set[str] = set()
    seen_service_ids: set[str] = set()
    seen_users: set[int] = set()
    to_create: list[Agent] = []
    created = skipped = updated = 0
    start_id = 1 if truncate else (Agent.objects.order_by("-pk").values_list("pk", flat=True).first() or 0) + 1
    next_id = start_id
    max_id = start_id - 1

    if not truncate and Agent.objects.exists():
        existing_by_service = {
            s: pk
            for s, pk in Agent.objects.exclude(service_id__isnull=True)
            .exclude(service_id="")
            .values_list("service_id", "pk")
        }
    else:
        existing_by_service = {}

    with transaction.atomic():
        for i, row in enumerate(rows, start=1):
            phone = _text(row, "phone", 15) or f"N/A-{i}"
            if phone in seen_phones:
                phone = f"DUP-{i}"[:15]
            seen_phones.add(phone)

            service_id = _text(row, "service_id", 50) or None
            if service_id and service_id in seen_service_ids:
                service_id = f"{service_id}-DUP{i}"[:50]
            if service_id:
                seen_service_ids.add(service_id)

            user_id = _fk(row, "user_id", valid_users)
            if user_id in seen_users:
                user_id = None
            if user_id:
                seen_users.add(user_id)

            created_at = _parse_dt(row.get("date_recorded")) or timezone.now()
            # Agent.personal_number CharField is shadowed by @property — do not pass it to Agent().
            fields = {
                "user_id": user_id,
                "service_id": service_id,
                "first_name": _text(row, "first_name", 50) or "—",
                "father_name": _text(row, "father_name", 50) or "—",
                "last_name": _text(row, "last_name", 50) or "—",
                "fourth_name": _text(row, "forth_name", 50) or "—",
                "mother_name": _text(row, "mother_name", 50) or "—",
                "nickname": _text(row, "nickname", 50) or None,
                "date_of_birth": _text(row, "date_of_birth", 50) or "—",
                "gender": _text(row, "gender", 50) or None,
                "phone": phone,
                "email": _text(row, "email") or None,
                "status": _text(row, "s_status", 20) or "Active",
                "present": _text(row, "present", 100) or "Joogey",
                "biography": _text(row, "biography") or None,
                "weapon_name": _text(row, "weapon_name", 200) or None,
                "serial_number": _text(row, "serial_number", 200) or None,
                "tribe_name": _named(row, "tribe1_id", tribes) or None,
                "region_name": _named(row, "region_id", regions) or None,
                "county_id": _fk(row, "county_id", valid_counties),
                "sub_county_name": _named(row, "sub_county_id", sub_counties) or None,
                "section_name": _named(row, "section_id", sections) or None,
                "directorate_id": _fk(row, "director_id", valid_directorates),
                "recorded_by_id": _fk(row, "recorded_by_id", valid_users),
                "created_at": created_at,
                "updated_at": created_at,
            }

            if service_id and service_id in existing_by_service:
                pk = existing_by_service[service_id]
                Agent.objects.filter(pk=pk).update(**fields)
                updated += 1
                max_id = max(max_id, pk)
                continue

            obj = Agent(id=next_id, **fields)
            next_id += 1
            max_id = max(max_id, obj.id)
            to_create.append(obj)
            created += 1
            if len(to_create) >= batch_size:
                bulk_create_preserving_timestamps(Agent, to_create, batch_size=batch_size)
                to_create.clear()

        if to_create:
            bulk_create_preserving_timestamps(Agent, to_create, batch_size=batch_size)

        if max_id > 0:
            with connection.cursor() as c:
                c.execute(
                    "SELECT setval(pg_get_serial_sequence('agents', 'id'), %s, true)",
                    [max_id],
                )

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "max_id": max_id,
        "model": "accounts.Agent",
    }
