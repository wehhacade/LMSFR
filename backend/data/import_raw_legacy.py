"""One-off: stream ALL split MySQL dumps into a `legacy` Postgres schema (full fidelity).

Every table keeps its original MySQL name and columns (stored as TEXT, lossless).
Run: python manage.py shell < /app/data/import_raw_legacy.py
"""

import glob
import os

from django.db import connection
from psycopg2.extras import execute_values

from apps.core.legacy_import.sql_dump import (
    _INSERT_RE,
    _parse_value,
    _split_columns,
    _split_row_tokens,
    _strip_row_line,
)

SPLIT_DIR = "/app/data/split"
BATCH = 2000


def to_text(value):
    if value is None:
        return None
    return str(value)


def ensure_table(cur, table, columns, known):
    if table not in known:
        cols_sql = ", ".join(f'"{c}" TEXT' for c in columns)
        cur.execute(f'DROP TABLE IF EXISTS legacy."{table}"')
        cur.execute(f'CREATE TABLE legacy."{table}" ({cols_sql})')
        known[table] = list(columns)
        return
    missing = [c for c in columns if c not in known[table]]
    for c in missing:
        cur.execute(f'ALTER TABLE legacy."{table}" ADD COLUMN "{c}" TEXT')
        known[table].append(c)


def flush(cur, table, columns, batch, counts):
    if not batch:
        return
    cols_sql = ", ".join(f'"{c}"' for c in columns)
    execute_values(
        cur,
        f'INSERT INTO legacy."{table}" ({cols_sql}) VALUES %s',
        batch,
        page_size=BATCH,
    )
    counts[table] = counts.get(table, 0) + len(batch)
    batch.clear()


known_tables: dict[str, list[str]] = {}
counts: dict[str, int] = {}

with connection.cursor() as c:
    c.execute("CREATE SCHEMA IF NOT EXISTS legacy")

files = sorted(glob.glob(os.path.join(SPLIT_DIR, "*.sql")))
print(f"{len(files)} files")

for path in files:
    table = None
    columns: list[str] | None = None
    batch: list[tuple] = []
    with connection.cursor() as cur, open(path, encoding="utf-8", errors="replace") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                continue
            if line.upper().startswith("INSERT INTO"):
                match = _INSERT_RE.search(line)
                if not match:
                    continue
                new_table = match.group(1).lower()
                new_columns = _split_columns(match.group("cols"))
                if table is not None and (new_table != table or new_columns != columns):
                    flush(cur, table, columns, batch, counts)
                table, columns = new_table, new_columns
                ensure_table(cur, table, columns, known_tables)
                continue
            if table is None or columns is None:
                continue
            inner = _strip_row_line(line)
            if inner is None:
                continue
            parts = _split_row_tokens(inner)
            if len(parts) != len(columns):
                print(f"!! {table}: column mismatch ({len(columns)} vs {len(parts)}) — row skipped")
                continue
            batch.append(tuple(to_text(_parse_value(p)) for p in parts))
            if len(batch) >= BATCH:
                flush(cur, table, columns, batch, counts)
        if table is not None:
            flush(cur, table, columns, batch, counts)
    print(f"{os.path.basename(path)} -> legacy.{table}: {counts.get(table, 0)} rows")

print("TOTAL tables:", len(counts), "rows:", sum(counts.values()))
