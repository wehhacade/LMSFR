"""Generic legacy row → Django model import (integer PK)."""

from __future__ import annotations

from datetime import date, datetime, timezone as dt_timezone
from decimal import Decimal, InvalidOperation

from django.db import connection, models, transaction
from django.utils import timezone

COLUMN_ALIASES: dict[str, str] = {
    "amniSir": "amni_sir",
    "qaybta_id": "department_id",
    # Keep date_recorded as-is when the model field is named date_recorded.
    # Tables that use created_at should map via TABLE_COLUMN_ALIASES.
}

# Old MySQL column names per v3 db_table
TABLE_COLUMN_ALIASES: dict[str, dict[str, str]] = {
    "regions": {
        "region_name": "name",
        "region_code": "code",
        "region_desc": "description",
    },
    "counties": {
        "county_name": "name",
        "county_code": "code",
        "county_desc": "description",
        "images": "image",
    },
    "sub_counties": {
        "sub_county_name": "name",
        "sub_county_code": "code",
        "sub_county_desc": "description",
    },
    "people_sections": {
        "section_name": "name",
        "section_code": "code",
    },
    "audit_trails": {
        "sub_module_id": "submodule",
        "date_of_event": "created_at",
    },
    "error_logs": {
        "users_id": "user_id",
    },
    "dhacdooyinka_dhacdodocuments": {
        "document": "name",
    },
    # Models that store timestamps as created_at / updated_at
    "staff": {
        "date_recorded": "created_at",
        "date_modified": "updated_at",
    },
    "agents": {
        "date_recorded": "created_at",
        "s_status": "status",
        "forth_name": "fourth_name",
        "director_id": "directorate_id",
    },
    "disarmament_records": {
        "tixraac_lambar": "reference_number",
        "magaca": "person_name",
        "taliska": "police_station",
        "lambarka_taleefoonka": "phone_number",
        "ciidanka_id": "force_unit_id",
        "lambarka_ciidanka": "force_number",
        "faahfaahinta_xogta": "details",
        "darajo_id": "rank_id",
        "nooca_hubka_id": "weapon_type_id",
        "lambarka_hubka": "weapon_serial",
        "degmada_id": "county_id",
        "goobta_laguwareejiyey_id": "surrender_location_id",
        "taariikhda": "surrender_date",
        "sawirka": "cover_image",
        "recorded_by_id": "created_by_id",
        "update_at": "updated_at",
        "date_recorded": "created_at",
    },
    # Legacy `hubkadhigis_images` → v3 disarmament_images
    "disarmament_images": {
        "lambarka_hubka": "weapon_serial",
        "taariikhda": "surrender_date",
        "degmada_id": "county_id",
        "goobta_laguwareejiyey_id": "surrender_location_id",
        "hubkadhigis_id": "record_id",
        "nooca_hubka_id": "weapon_type_id",
        "date_recorded": "created_at",
    },
    "dhacdooyinka_dhacdodocuments": {
        "document": "name",
    },
}

from apps.core.legacy_import.timestamps import bulk_create_preserving_timestamps

# Primary key column names in legacy SQL dumps (first match wins)
TABLE_PK_COLUMNS: dict[str, list[str]] = {
    "regions": ["id", "region_id"],
    "counties": ["id", "county_id"],
    "sub_counties": ["id", "sub_county_id"],
    "people_sections": ["id", "section_id"],
    "audit_trails": ["id", "audit_id"],
    "error_logs": ["id", "error_no"],
}

# Columns ignored for every table (legacy junk / unused).
SKIP_COLUMNS: set[str] = {
    "profile",
    "source_id",
    "caseOfficer_id",
    "day",  # split date parts — prefer created_at / date_opp
    "source_mediator_incident_id",
}

# Per-table extras (e.g. agents day/month/year are not model fields we want).
TABLE_SKIP_COLUMNS: dict[str, set[str]] = {
    "agents": {"month", "year", "date_opp", "is_mobile", "marital_status_id", "neigh_id", "street_id"},
    "suspects": {"month", "year"},
    "suspectcase": {"month", "year", "date_opp"},
    "damiinada": {"month", "year", "date_opp", "temp_sup"},
    # dhacdo / dhibane keep year + month + date_opp as real fields
}


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


def _parse_date(value):
    if value in (None, "", "NULL"):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    dt = _parse_dt(value)
    return dt.date() if dt else None


def _coerce_value(field: models.Field, value):
    if value is None or value == "" or str(value).upper() == "NULL":
        if isinstance(field, models.BooleanField):
            return False
        if isinstance(
            field,
            (models.CharField, models.TextField, models.EmailField, models.URLField, models.SlugField),
        ) and field.blank and not field.null:
            return ""
        return None

    if isinstance(field, models.BooleanField):
        return _parse_bool(value)

    if isinstance(field, models.DateTimeField):
        return _parse_dt(value)

    if isinstance(field, models.DateField):
        return _parse_date(value)

    if isinstance(field, models.ForeignKey):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    if isinstance(
        field,
        (
            models.IntegerField,
            models.BigIntegerField,
            models.SmallIntegerField,
            models.PositiveIntegerField,
            models.PositiveSmallIntegerField,
            models.AutoField,
            models.BigAutoField,
        ),
    ):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    if isinstance(field, models.DecimalField):
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError):
            return None

    if isinstance(field, models.FloatField):
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    if isinstance(field, models.GenericIPAddressField):
        import ipaddress

        try:
            return str(ipaddress.ip_address(str(value).strip()))
        except ValueError:
            return None

    if isinstance(field, models.FileField):
        # Keep the legacy relative media path (e.g. uploads/…/photo.jpg)
        text = str(value)
        max_len = getattr(field, "max_length", None)
        if max_len:
            text = text[:max_len]
        return text

    if isinstance(field, (models.CharField, models.TextField, models.EmailField, models.URLField, models.SlugField)):
        text = str(value)
        max_len = getattr(field, "max_length", None)
        if max_len:
            text = text[:max_len]
        return text

    return value


def _model_field_map(model: type[models.Model]) -> dict[str, models.Field]:
    fields: dict[str, models.Field] = {}
    for f in model._meta.get_fields():
        if not getattr(f, "concrete", False):
            continue
        if isinstance(f, models.ManyToManyField):
            continue
        if isinstance(f, models.ForeignKey):
            fields[f.attname] = f
            fields[f.name] = f
        else:
            fields[f.name] = f
    return fields


def _resolve_column(table: str, raw_key: str) -> str:
    if raw_key in TABLE_COLUMN_ALIASES.get(table, {}):
        return TABLE_COLUMN_ALIASES[table][raw_key]
    return COLUMN_ALIASES.get(raw_key, raw_key)


def _resolve_pk(table: str, row: dict):
    for key in TABLE_PK_COLUMNS.get(table, ["id"]):
        val = row.get(key)
        if val not in (None, ""):
            return val
    return None


def _row_to_data(
    model: type[models.Model],
    row: dict,
    field_map: dict[str, models.Field],
    *,
    table: str,
) -> tuple[dict, object | None]:
    data: dict = {}
    legacy_pk = _resolve_pk(table, row)
    pk_keys = set(TABLE_PK_COLUMNS.get(table, ["id"]))

    table_skip = TABLE_SKIP_COLUMNS.get(table, set())
    for raw_key, raw_val in row.items():
        if raw_key in SKIP_COLUMNS or raw_key in table_skip or raw_key in pk_keys:
            continue
        key = _resolve_column(table, raw_key)
        field = field_map.get(key)
        if field is None:
            continue
        att = field.attname if isinstance(field, models.ForeignKey) else field.name
        data[att] = _coerce_value(field, raw_val)

    # Legacy Surveys used is_active; v3 uses status (draft/live/closed).
    if table == "surveys_survey":
        if "status" not in data and "is_active" in row:
            data["status"] = "live" if _parse_bool(row.get("is_active")) else "draft"
        if data.get("created_at") and not data.get("updated_at"):
            data["updated_at"] = data["created_at"]

    return data, legacy_pk


def _sanitize_missing_fks(model: type[models.Model], data: dict) -> bool:
    """
    Drop invalid FK values so rows are kept whenever possible.
    - nullable FKs pointing at missing parents → set None
    - required FKs missing → return False (must skip row)
    """
    for field in model._meta.concrete_fields:
        if not isinstance(field, models.ForeignKey):
            continue
        val = data.get(field.attname)
        if val in (None, ""):
            if not field.null:
                return False
            data[field.attname] = None
            continue
        related = field.related_model
        if related is None:
            continue
        if related.objects.filter(pk=val).exists():
            continue
        if field.null:
            data[field.attname] = None
            continue
        return False
    return True


def import_model_rows(
    model: type[models.Model],
    rows: list[dict],
    *,
    truncate: bool = False,
    batch_size: int = 200,
) -> dict:
    table = model._meta.db_table
    field_map = _model_field_map(model)
    batch_size = max(50, batch_size)

    if truncate:
        with connection.cursor() as c:
            c.execute(f'TRUNCATE "{table}" CASCADE')

    created = updated = skipped = 0
    max_id = 0
    existing_ids = set(model.objects.values_list("pk", flat=True))
    to_create: list[models.Model] = []
    pk_name = model._meta.pk.attname

    with transaction.atomic():
        for row in rows:
            data, legacy_pk = _row_to_data(model, row, field_map, table=table)
            if legacy_pk in (None, ""):
                skipped += 1
                continue
            try:
                pk_val = int(legacy_pk)
            except (TypeError, ValueError):
                skipped += 1
                continue

            max_id = max(max_id, pk_val)
            if not _sanitize_missing_fks(model, data):
                skipped += 1
                continue

            obj = model(pk=pk_val, **{k: v for k, v in data.items() if k != pk_name})

            if pk_val in existing_ids:
                update_data = {
                    f.attname: getattr(obj, f.attname)
                    for f in model._meta.concrete_fields
                    if not f.primary_key
                }
                model.objects.filter(pk=pk_val).update(**update_data)
                updated += 1
            else:
                to_create.append(obj)
                existing_ids.add(pk_val)
                created += 1
                if len(to_create) >= batch_size:
                    bulk_create_preserving_timestamps(model, to_create, batch_size=batch_size)
                    to_create.clear()

        if to_create:
            bulk_create_preserving_timestamps(model, to_create, batch_size=batch_size)

        pk_field = model._meta.pk
        if max_id and isinstance(pk_field, (models.AutoField, models.BigAutoField)):
            with connection.cursor() as c:
                c.execute(
                    "SELECT setval(pg_get_serial_sequence(%s, %s), %s, true)",
                    [table, pk_field.column, max_id],
                )

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "max_id": max_id,
        "model": f"{model._meta.app_label}.{model.__name__}",
    }
