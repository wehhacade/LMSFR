"""Import legacy `suspects` table rows into PostgreSQL v3."""

from __future__ import annotations

from datetime import date, datetime, timezone as dt_timezone

from django.db import connection, transaction
from django.utils import timezone

from apps.accounts.models import County, Country, SubCounty
from apps.core.legacy_import.timestamps import bulk_create_preserving_timestamps
from apps.suspects.models import Suspect, SuspectStatus

BOOL_FIELDS = ("is_released",)

FK_FIELDS: tuple[tuple[str, str, type], ...] = (
    ("address_id", "address_id", County),
    ("capture_county_id", "capture_county_id", County),
    ("capture_sub_county_id", "capture_sub_county_id", SubCounty),
    ("nationality_id", "nationality_id", Country),
    ("suspect_type_id", "status_id", SuspectStatus),
    ("created_by_id", "user_id", None),  # User — checked separately
)


def _parse_bool(value) -> bool:
    if value is None or value == "":
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in ("1", "true", "yes", "t")


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


def _case_ref(row: dict, pk: int) -> str:
    for key in ("suspect_identifier", "lambarka_diiwaanka"):
        val = row.get(key)
        if val not in (None, "", "NULL"):
            return _text(val, max_len=64) or f"LEG-{pk}"
    return f"LEG-{pk}"


def _district(row: dict) -> str:
    for key in ("goobta_shaqada", "goobta_dhalashada", "occupation"):
        val = _text(row.get(key), max_len=120)
        if val:
            return val
    return ""


def _last_seen(row: dict, created_at: datetime | None) -> date:
    for key in ("date_opp", "date_of_birth"):
        val = _parse_date(row.get(key))
        if val:
            return val
    if created_at:
        return created_at.date()
    return timezone.localdate()


def _offense(row: dict) -> str:
    for key in ("description", "lambarka_diiwaanka", "tribe"):
        val = _text(row.get(key), max_len=255)
        if val:
            return val
    return "—"


def _set_fk(suspect: Suspect, row: dict, attr: str, raw_key: str, model) -> None:
    val = row.get(raw_key)
    if val in (None, "", 0, "0"):
        return
    try:
        pk = int(val)
    except (TypeError, ValueError):
        return
    if model is not None and not model.objects.filter(pk=pk).exists():
        return
    setattr(suspect, attr, pk)


def _set_user_fk(suspect: Suspect, row: dict, valid_user_ids: set[int]) -> None:
    val = row.get("user_id")
    if val in (None, "", 0, "0"):
        return
    try:
        pk = int(val)
    except (TypeError, ValueError):
        return
    if pk in valid_user_ids:
        suspect.created_by_id = pk


def _build_suspect(row: dict, *, valid_user_ids: set[int]) -> Suspect | None:
    pk = row.get("id")
    if pk in (None, ""):
        return None
    pk = int(pk)

    created_at = _parse_dt(row.get("created_at")) or timezone.now()
    updated_at = _parse_dt(row.get("modified_at")) or created_at

    suspect = Suspect(
        id=pk,
        name=_text(row.get("fullname"), max_len=200) or f"Suspect {pk}",
        alias=_text(row.get("nickname"), max_len=120),
        mother_name=_text(row.get("mother_name"), max_len=100),
        photo_url=_text(row.get("picture"), max_len=500),
        district=_district(row),
        case_ref=_case_ref(row, pk),
        status=Suspect.Status.CLEARED if _parse_bool(row.get("is_released")) else Suspect.Status.ACTIVE,
        risk=Suspect.Risk.MEDIUM,
        date_of_birth=_parse_date(row.get("date_of_birth")),
        goobta_dhalashada=_text(row.get("goobta_dhalashada"), max_len=100),
        phone=_text(row.get("phone"), max_len=20),
        marriage_status=_text(row.get("marriage_status"), max_len=100),
        children=max(0, int(row.get("children") or 0)),
        xabsi_waligaa_ma_soo_martay=_text(row.get("xabsi_waligaa_ma_soo_martay"), max_len=50),
        tribe=_text(row.get("tribe"), max_len=100),
        occupation=_text(row.get("occupation"), max_len=100),
        lambarka_diiwaanka=_text(row.get("lambarka_diiwaanka"), max_len=100),
        is_released=_parse_bool(row.get("is_released")),
        bail_count=max(0, int(row.get("bail_count") or 0)),
        father_contact=_text(row.get("father_contact"), max_len=50),
        mother_contact=_text(row.get("mother_contact"), max_len=50),
        date_opp=_parse_date(row.get("date_opp")),
        day=_text(row.get("day"), max_len=10),
        month=_text(row.get("month"), max_len=10),
        year=_text(row.get("year"), max_len=10),
        latitude=_text(row.get("latitude"), max_len=20),
        longitude=_text(row.get("longitude"), max_len=20),
        gender=_text(row.get("gender"), max_len=50),
        goobta_shaqada=_text(row.get("goobta_shaqada"), max_len=100),
        suspect_identifier=_text(row.get("suspect_identifier"), max_len=300),
        last_seen=_last_seen(row, created_at),
        offense=_offense(row),
        notes=_text(row.get("description")),
        created_at=created_at,
        updated_at=updated_at,
    )

    for attr, raw_key, model in FK_FIELDS:
        _set_fk(suspect, row, attr, raw_key, model)
    _set_user_fk(suspect, row, valid_user_ids)

    return suspect


def _suspect_fields(suspect: Suspect) -> dict:
    return {
        f.attname: getattr(suspect, f.attname)
        for f in Suspect._meta.concrete_fields
        if not f.primary_key
    }


def import_suspects(rows: list[dict], *, truncate: bool = False, batch_size: int = 200) -> dict:
    from django.contrib.auth import get_user_model

    User = get_user_model()

    if truncate:
        with connection.cursor() as c:
            c.execute('TRUNCATE "suspects" CASCADE')

    valid_user_ids = set(User.objects.values_list("pk", flat=True))
    batch_size = max(50, batch_size)
    created = updated = skipped = 0
    max_id = 0
    existing_ids = set(Suspect.objects.values_list("pk", flat=True))
    to_create: list[Suspect] = []
    seen_case_refs: set[str] = set(Suspect.objects.values_list("case_ref", flat=True))

    with transaction.atomic():
        for row in rows:
            suspect = _build_suspect(row, valid_user_ids=valid_user_ids)
            if suspect is None:
                skipped += 1
                continue

            case_ref = suspect.case_ref
            if case_ref in seen_case_refs:
                suspect.case_ref = f"{case_ref}-{suspect.id}"[:64]
            seen_case_refs.add(suspect.case_ref)

            max_id = max(max_id, suspect.id)

            if suspect.id in existing_ids:
                Suspect.objects.filter(pk=suspect.id).update(**_suspect_fields(suspect))
                updated += 1
            else:
                to_create.append(suspect)
                existing_ids.add(suspect.id)
                created += 1
                if len(to_create) >= batch_size:
                    bulk_create_preserving_timestamps(Suspect, to_create, batch_size=batch_size)
                    to_create.clear()

        if to_create:
            bulk_create_preserving_timestamps(Suspect, to_create, batch_size=batch_size)

        if max_id:
            with connection.cursor() as c:
                c.execute(
                    "SELECT setval(pg_get_serial_sequence('suspects', 'id'), %s, true)",
                    [max_id],
                )

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "max_id": max_id,
        "model": "suspects.Suspect",
    }
