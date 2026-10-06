"""Helpers so legacy imports keep original created/updated timestamps.

Django's bulk_create() still runs Field.pre_save(), which overwrites
auto_now_add / auto_now fields with timezone.now(). After bulk_create we
force the intended values with UPDATE (bypasses auto_now).
"""

from __future__ import annotations

from django.core.exceptions import FieldDoesNotExist
from django.db import connection, models


AUTO_TS_ATTRS = (
    "created_at",
    "updated_at",
    "modified_at",
    "update_at",
    "date_recorded",
    "date_modified",
    "submitted_at",
    "last_updated",
)


def snapshot_auto_timestamps(obj: models.Model) -> dict:
    """Capture timestamp field values before bulk_create mutates them."""
    out: dict = {}
    for name in AUTO_TS_ATTRS:
        try:
            field = obj._meta.get_field(name)
        except FieldDoesNotExist:
            continue
        if not isinstance(field, (models.DateTimeField, models.DateField)):
            continue
        val = getattr(obj, field.attname, None)
        if val is not None:
            out[field.attname] = val
    return out


def restore_auto_timestamps(model: type[models.Model], snapshots: list[tuple[int, dict]]) -> None:
    """Apply captured timestamps after bulk_create via batched UPDATE."""
    if not snapshots:
        return

    by_cols: dict[tuple[str, ...], list[tuple[int, dict]]] = {}
    for pk, data in snapshots:
        if not data:
            continue
        key = tuple(sorted(data.keys()))
        by_cols.setdefault(key, []).append((pk, data))

    table = model._meta.db_table
    pk_col = model._meta.pk.column
    qn = connection.ops.quote_name

    with connection.cursor() as cursor:
        for cols, items in by_cols.items():
            set_sql = ", ".join(f"{qn(c)} = %s" for c in cols)
            sql = f'UPDATE {qn(table)} SET {set_sql} WHERE {qn(pk_col)} = %s'
            params = [tuple(data[c] for c in cols) + (pk,) for pk, data in items]
            cursor.executemany(sql, params)


def bulk_create_preserving_timestamps(
    model: type[models.Model],
    objs: list[models.Model],
    *,
    batch_size: int = 200,
) -> None:
    if not objs:
        return
    snaps = [(obj.pk, snapshot_auto_timestamps(obj)) for obj in objs if obj.pk is not None]
    model.objects.bulk_create(objs, batch_size=batch_size)
    restore_auto_timestamps(model, snaps)
