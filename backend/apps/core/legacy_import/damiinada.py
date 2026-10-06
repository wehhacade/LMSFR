"""Import legacy `damiinada` (guarantor) rows into PostgreSQL v3."""

from __future__ import annotations

from datetime import datetime, timezone as dt_timezone

from django.db import connection, transaction
from django.utils import timezone

from apps.accounts.models import County, Relationship, SubCounty
from apps.core.legacy_import.timestamps import bulk_create_preserving_timestamps
from apps.suspects.models import Damiinada


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


def _text(value, *, max_len: int | None = None) -> str:
    text = "" if value in (None, "NULL") else str(value).strip()
    if max_len:
        text = text[:max_len]
    return text


def _code(row: dict, pk: int) -> str:
    for key in ("DamiinadaCode", "tixraacNum"):
        val = _text(row.get(key), max_len=20)
        if val:
            return val
    return f"DA{pk:05d}"


def _set_fk(obj: Damiinada, row: dict, attr: str, raw_key: str, model) -> None:
    val = row.get(raw_key)
    if val in (None, "", 0, "0"):
        return
    try:
        pk = int(val)
    except (TypeError, ValueError):
        return
    if model.objects.filter(pk=pk).exists():
        setattr(obj, attr, pk)


def _build_damiin(row: dict, *, valid_user_ids: set[int]) -> Damiinada | None:
    pk = row.get("id")
    if pk in (None, ""):
        return None
    pk = int(pk)

    created_at = _parse_dt(row.get("created_at")) or timezone.now()
    workplace = _text(row.get("goobta_shaqada"), max_len=200) or _text(row.get("address"), max_len=200)

    obj = Damiinada(
        id=pk,
        code=_code(row, pk),
        name=_text(row.get("name"), max_len=200) or f"Damiin {pk}",
        phone=_text(row.get("phone"), max_len=30),
        relationship=_text(row.get("relationship"), max_len=80),
        occupation=_text(row.get("occupation"), max_len=200),
        workplace=workplace,
        description=_text(row.get("description")),
        picture_url=_text(row.get("picture"), max_len=500),
        identity_picture_url=_text(row.get("identityPicture"), max_len=500),
        created_at=created_at,
    )

    _set_fk(obj, row, "county_id", "deg_Damiinada_id", County)
    _set_fk(obj, row, "sub_county_id", "sub_county_id", SubCounty)
    _set_fk(obj, row, "new_relationship_id", "new_relationship_id", Relationship)

    user_id = row.get("user_id")
    if user_id not in (None, "", 0, "0"):
        try:
            uid = int(user_id)
            if uid in valid_user_ids:
                obj.created_by_id = uid
        except (TypeError, ValueError):
            pass

    return obj


def _damiin_fields(obj: Damiinada) -> dict:
    return {
        f.attname: getattr(obj, f.attname)
        for f in Damiinada._meta.concrete_fields
        if not f.primary_key
    }


def import_damiinada(rows: list[dict], *, truncate: bool = False, batch_size: int = 200) -> dict:
    from django.contrib.auth import get_user_model

    User = get_user_model()

    if truncate:
        with connection.cursor() as c:
            c.execute('TRUNCATE "damiinada" CASCADE')

    valid_user_ids = set(User.objects.values_list("pk", flat=True))
    batch_size = max(50, batch_size)
    created = updated = skipped = 0
    max_id = 0
    existing_ids = set(Damiinada.objects.values_list("pk", flat=True))
    seen_codes: set[str] = set(Damiinada.objects.values_list("code", flat=True))
    to_create: list[Damiinada] = []

    with transaction.atomic():
        for row in rows:
            obj = _build_damiin(row, valid_user_ids=valid_user_ids)
            if obj is None:
                skipped += 1
                continue

            code = obj.code
            if not code or code in seen_codes:
                obj.code = f"DA{obj.id:05d}"
                if obj.code in seen_codes:
                    obj.code = f"DA{obj.id:05d}X"[:20]
            seen_codes.add(obj.code)

            max_id = max(max_id, obj.id)

            if obj.id in existing_ids:
                Damiinada.objects.filter(pk=obj.id).update(**_damiin_fields(obj))
                updated += 1
            else:
                to_create.append(obj)
                existing_ids.add(obj.id)
                created += 1
                if len(to_create) >= batch_size:
                    bulk_create_preserving_timestamps(Damiinada, to_create, batch_size=batch_size)
                    to_create.clear()

        if to_create:
            bulk_create_preserving_timestamps(Damiinada, to_create, batch_size=batch_size)

        if max_id:
            with connection.cursor() as c:
                c.execute(
                    "SELECT setval(pg_get_serial_sequence('damiinada', 'id'), %s, true)",
                    [max_id],
                )

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "max_id": max_id,
        "model": "suspects.Damiinada",
    }
