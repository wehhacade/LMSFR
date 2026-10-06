"""Truncate legacy tables before re-import."""

from __future__ import annotations

from django.db import connection

from apps.core.legacy_import.auth_groups import AUTH_GROUP_TABLES
from apps.core.legacy_import.registry import model_for_table, resolve_table

# Alias → multiple db tables (single TRUNCATE … CASCADE)
TABLE_GROUPS: dict[str, list[str]] = {
    "locations": ["regions", "counties", "sub_counties"],
    "location": ["regions", "counties", "sub_counties"],
    "auth_groups": list(AUTH_GROUP_TABLES),
    "groups": list(AUTH_GROUP_TABLES),
}


def resolve_truncate_targets(names: list[str]) -> list[str]:
    out: list[str] = []
    for raw in names:
        key = raw.lower().strip().replace("-", "_")
        if key in TABLE_GROUPS:
            out.extend(TABLE_GROUPS[key])
            continue
        table = resolve_table(key)
        if model_for_table(table) is None and table not in (
            "users",
            "auth_group",
            "auth_group_permissions",
            "users_groups",
        ):
            raise ValueError(f"Unknown table `{raw}` (resolved: `{table}`)")
        out.append(table)

    seen: set[str] = set()
    unique: list[str] = []
    for t in out:
        if t not in seen:
            seen.add(t)
            unique.append(t)
    return unique


def truncate_tables(names: list[str]) -> list[str]:
    tables = resolve_truncate_targets(names)
    if not tables:
        return []

    quoted = ", ".join(f'"{t}"' for t in tables)
    with connection.cursor() as cursor:
        cursor.execute(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE")
    return tables
