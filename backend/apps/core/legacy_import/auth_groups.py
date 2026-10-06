"""Import legacy Django auth groups + M2M tables from phpMyAdmin SQL dumps."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.db import connection, transaction

from apps.core.legacy_import.generic import import_model_rows

User = get_user_model()

AUTH_GROUP_TABLES = ("users_groups", "auth_group_permissions", "auth_group")


def truncate_auth_groups() -> list[str]:
    quoted = ", ".join(f'"{t}"' for t in AUTH_GROUP_TABLES)
    with connection.cursor() as cursor:
        cursor.execute(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE")
    return list(AUTH_GROUP_TABLES)


def import_auth_group(rows: list[dict], *, truncate: bool = False, batch_size: int = 200) -> dict:
    return import_model_rows(Group, rows, truncate=truncate, batch_size=batch_size)


def _import_through_rows(
    table: str,
    rows: list[dict],
    *,
    truncate: bool = False,
    batch_size: int = 500,
    valid_fks: dict[str, set[int]],
) -> dict:
    if truncate:
        with connection.cursor() as cursor:
            cursor.execute(f'TRUNCATE "{table}" RESTART IDENTITY CASCADE')

    created = skipped = 0
    max_id = 0
    batch: list[tuple] = []

    def flush() -> None:
        nonlocal created
        if not batch:
            return
        with connection.cursor() as cursor:
            cursor.executemany(
                f'INSERT INTO "{table}" ("id", "group_id", "permission_id") VALUES (%s, %s, %s)'
                if table == "auth_group_permissions"
                else f'INSERT INTO "{table}" ("id", "user_id", "group_id") VALUES (%s, %s, %s)',
                batch,
            )
        created += len(batch)
        batch.clear()

    with transaction.atomic():
        for row in rows:
            pk = row.get("id")
            if pk in (None, ""):
                skipped += 1
                continue
            try:
                pk_val = int(pk)
            except (TypeError, ValueError):
                skipped += 1
                continue

            if table == "auth_group_permissions":
                group_id = row.get("group_id")
                perm_id = row.get("permission_id")
                if group_id in (None, "") or perm_id in (None, ""):
                    skipped += 1
                    continue
                try:
                    group_id = int(group_id)
                    perm_id = int(perm_id)
                except (TypeError, ValueError):
                    skipped += 1
                    continue
                if group_id not in valid_fks["group_id"] or perm_id not in valid_fks["permission_id"]:
                    skipped += 1
                    continue
                values = (pk_val, group_id, perm_id)
            else:
                user_key = "users_id" if row.get("users_id") not in (None, "") else "user_id"
                user_id = row.get(user_key)
                group_id = row.get("group_id")
                if user_id in (None, "") or group_id in (None, ""):
                    skipped += 1
                    continue
                try:
                    user_id = int(user_id)
                    group_id = int(group_id)
                except (TypeError, ValueError):
                    skipped += 1
                    continue
                if user_id not in valid_fks["user_id"] or group_id not in valid_fks["group_id"]:
                    skipped += 1
                    continue
                values = (pk_val, user_id, group_id)

            max_id = max(max_id, pk_val)
            batch.append(values)
            if len(batch) >= batch_size:
                flush()

        flush()

        if max_id:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT setval(pg_get_serial_sequence(%s, 'id'), %s, true)",
                    [table, max_id],
                )

    return {
        "created": created,
        "updated": 0,
        "skipped": skipped,
        "max_id": max_id,
        "model": table,
    }


def import_auth_group_permissions(
    rows: list[dict], *, truncate: bool = False, batch_size: int = 500
) -> dict:
    valid = {
        "group_id": set(Group.objects.values_list("pk", flat=True)),
        "permission_id": set(Permission.objects.values_list("pk", flat=True)),
    }
    return _import_through_rows(
        "auth_group_permissions",
        rows,
        truncate=truncate,
        batch_size=batch_size,
        valid_fks=valid,
    )


def import_users_groups(rows: list[dict], *, truncate: bool = False, batch_size: int = 500) -> dict:
    valid = {
        "user_id": set(User.objects.values_list("pk", flat=True)),
        "group_id": set(Group.objects.values_list("pk", flat=True)),
    }
    return _import_through_rows(
        "users_groups",
        rows,
        truncate=truncate,
        batch_size=batch_size,
        valid_fks=valid,
    )


def import_auth_groups_bundle(
    *,
    group_rows: list[dict],
    permission_rows: list[dict],
    users_group_rows: list[dict],
    truncate: bool = False,
    batch_size: int = 200,
) -> dict:
    if truncate:
        truncate_auth_groups()

    group_result = import_auth_group(group_rows, truncate=False, batch_size=batch_size)
    perm_result = import_auth_group_permissions(permission_rows, truncate=False, batch_size=batch_size)
    users_result = import_users_groups(users_group_rows, truncate=False, batch_size=batch_size)

    return {
        "auth_group": group_result,
        "auth_group_permissions": perm_result,
        "users_groups": users_result,
    }
