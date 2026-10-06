"""Import legacy `suspectcase` rows into PostgreSQL v3."""

from __future__ import annotations

from datetime import date, datetime, timezone as dt_timezone

from django.db import connection, transaction
from django.utils import timezone

from apps.accounts.models import County, SubCounty
from apps.core.legacy_import.timestamps import bulk_create_preserving_timestamps
from apps.suspects.models import Damiinada, Suspect, SuspectCase, SuspectStatus


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


def _parse_date(value) -> date | None:
    dt = _parse_dt(value)
    return dt.date() if dt else None


def _text(value, *, max_len: int | None = None) -> str:
    text = "" if value in (None, "NULL") else str(value).strip()
    if max_len:
        text = text[:max_len]
    return text


def _case_code(row: dict, pk: int) -> str:
    val = _text(row.get("CaseCode"), max_len=20)
    return val or f"SC{pk:05d}"


def _optional_fk(val, valid_ids: set[int]) -> int | None:
    if val in (None, "", 0, "0"):
        return None
    try:
        pk = int(val)
    except (TypeError, ValueError):
        return None
    return pk if pk in valid_ids else None


def _build_case(
    row: dict,
    *,
    valid_suspect_ids: set[int],
    valid_damiin_ids: set[int],
    valid_status_ids: set[int],
    valid_county_ids: set[int],
    valid_sub_county_ids: set[int],
    valid_user_ids: set[int],
) -> SuspectCase | None:
    pk = row.get("id")
    if pk in (None, ""):
        return None
    pk = int(pk)

    suspect_id = _optional_fk(row.get("suspect_id"), valid_suspect_ids)
    if suspect_id is None:
        return None

    created_at = _parse_dt(row.get("created_at")) or timezone.now()

    case = SuspectCase(
        id=pk,
        case_code=_case_code(row, pk),
        description=_text(row.get("description")),
        suspect_id=suspect_id,
        created_at=created_at,
    )

    damiin_id = _optional_fk(row.get("damiin_id"), valid_damiin_ids)
    if damiin_id is not None:
        case.damiin_id = damiin_id

    tuhunka_id = _optional_fk(row.get("Tuhunka_id"), valid_status_ids)
    if tuhunka_id is not None:
        case.tuhunka_id = tuhunka_id

    county_id = _optional_fk(row.get("d_qabashada_id"), valid_county_ids)
    if county_id is not None:
        case.capture_county_id = county_id

    sub_county_id = _optional_fk(row.get("w_qabashada_id"), valid_sub_county_ids)
    if sub_county_id is not None:
        case.capture_sub_county_id = sub_county_id

    user_id = _optional_fk(row.get("user_id"), valid_user_ids)
    if user_id is not None:
        case.created_by_id = user_id

    return case


def _case_fields(case: SuspectCase) -> dict:
    return {
        f.attname: getattr(case, f.attname)
        for f in SuspectCase._meta.concrete_fields
        if not f.primary_key
    }


def import_suspectcase(rows: list[dict], *, truncate: bool = False, batch_size: int = 200) -> dict:
    from django.contrib.auth import get_user_model

    User = get_user_model()

    if truncate:
        with connection.cursor() as c:
            c.execute('TRUNCATE "suspectcase" CASCADE')

    valid = {
        "suspect": set(Suspect.objects.values_list("pk", flat=True)),
        "damiin": set(Damiinada.objects.values_list("pk", flat=True)),
        "status": set(SuspectStatus.objects.values_list("pk", flat=True)),
        "county": set(County.objects.values_list("pk", flat=True)),
        "sub_county": set(SubCounty.objects.values_list("pk", flat=True)),
        "user": set(User.objects.values_list("pk", flat=True)),
    }

    batch_size = max(50, batch_size)
    created = updated = skipped = 0
    max_id = 0
    existing_ids = set(SuspectCase.objects.values_list("pk", flat=True))
    seen_codes: set[str] = set(SuspectCase.objects.values_list("case_code", flat=True))
    to_create: list[SuspectCase] = []

    with transaction.atomic():
        for row in rows:
            case = _build_case(
                row,
                valid_suspect_ids=valid["suspect"],
                valid_damiin_ids=valid["damiin"],
                valid_status_ids=valid["status"],
                valid_county_ids=valid["county"],
                valid_sub_county_ids=valid["sub_county"],
                valid_user_ids=valid["user"],
            )
            if case is None:
                skipped += 1
                continue

            if case.case_code in seen_codes:
                case.case_code = f"SC{case.id:05d}"
            seen_codes.add(case.case_code)

            max_id = max(max_id, case.id)

            if case.id in existing_ids:
                SuspectCase.objects.filter(pk=case.id).update(**_case_fields(case))
                updated += 1
            else:
                to_create.append(case)
                existing_ids.add(case.id)
                created += 1
                if len(to_create) >= batch_size:
                    bulk_create_preserving_timestamps(SuspectCase, to_create, batch_size=batch_size)
                    to_create.clear()

        if to_create:
            bulk_create_preserving_timestamps(SuspectCase, to_create, batch_size=batch_size)

        if max_id:
            with connection.cursor() as c:
                c.execute(
                    "SELECT setval(pg_get_serial_sequence('suspectcase', 'id'), %s, true)",
                    [max_id],
                )

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "max_id": max_id,
        "model": "suspects.SuspectCase",
    }
