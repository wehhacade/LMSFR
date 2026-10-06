"""One-off: stream legacy traffics_apitrafficlog into public.api_traffic_logs.

Raw SQL insert preserves id and created_at (bypasses auto_now_add).
duration (seconds, float) -> duration_ms (int).
Run: python manage.py shell < /app/data/import_traffic_logs.py
"""

import ipaddress

from django.db import connection
from psycopg2.extras import execute_values

from apps.core.legacy_import.sql_dump import (
    _INSERT_RE,
    _parse_value,
    _split_columns,
    _split_row_tokens,
    _strip_row_line,
)

PATH = "/app/data/split/traffics_apitrafficlog.sql"
BATCH = 5000


def clean_ip(value):
    try:
        return str(ipaddress.ip_address(str(value).strip()))
    except ValueError:
        return None


total = 0
max_id = 0
columns = None
batch = []

with connection.cursor() as cur, open(PATH, encoding="utf-8", errors="replace") as fh:
    cur.execute("TRUNCATE api_traffic_logs")

    def flush():
        global total
        if not batch:
            return
        execute_values(
            cur,
            "INSERT INTO api_traffic_logs (id, method, path, status_code, duration_ms, ip_address, created_at, user_id) VALUES %s",
            batch,
            template="(%s, %s, %s, %s, %s, %s, %s::timestamptz, NULL)",
            page_size=BATCH,
        )
        total += len(batch)
        batch.clear()

    for raw_line in fh:
        line = raw_line.strip()
        if not line:
            continue
        if line.upper().startswith("INSERT INTO"):
            match = _INSERT_RE.search(line)
            if match:
                columns = _split_columns(match.group("cols"))
            continue
        if columns is None:
            continue
        inner = _strip_row_line(line)
        if inner is None:
            continue
        parts = _split_row_tokens(inner)
        if len(parts) != len(columns):
            continue
        row = {col: _parse_value(val) for col, val in zip(columns, parts)}
        pk = row.get("id")
        if pk in (None, ""):
            continue
        pk = int(pk)
        max_id = max(max_id, pk)
        duration = row.get("duration") or 0
        try:
            duration_ms = max(0, int(round(float(duration) * 1000)))
        except (TypeError, ValueError):
            duration_ms = 0
        status = row.get("status_code")
        try:
            status = max(0, int(status))
        except (TypeError, ValueError):
            status = 0
        ts = str(row.get("timestamp") or "1970-01-01 00:00:00")
        batch.append(
            (
                pk,
                str(row.get("method") or "")[:10],
                str(row.get("path") or "")[:255],
                status,
                duration_ms,
                clean_ip(row.get("ip_address")),
                ts,
            )
        )
        if len(batch) >= BATCH:
            flush()
            if total % 100000 == 0:
                print(f"...{total} rows")

    flush()
    if max_id:
        cur.execute("SELECT setval(pg_get_serial_sequence('api_traffic_logs', 'id'), %s, true)", [max_id])

print(f"api_traffic_logs: inserted {total}, max_id {max_id}")
