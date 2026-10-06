from datetime import timedelta

from django.db import connection
from psycopg2.extras import execute_values

from apps.core.legacy_import.sql_dump import load_sql_file, parse_insert_rows

rows = parse_insert_rows(load_sql_file("/app/data/split/surveys_response.sql"), "surveys_response")
values = []
for r in rows:
    v = r.get("deadline_date")
    if r.get("id") in (None, "") or v in (None, ""):
        continue
    values.append((int(r["id"]), timedelta(microseconds=int(v))))

with connection.cursor() as c:
    execute_values(
        c.cursor,
        "UPDATE surveys_response t SET deadline_duration = v.d "
        "FROM (VALUES %s) AS v(id, d) WHERE t.id = v.id",
        values,
        template="(%s, %s::interval)",
        page_size=5000,
    )
print(f"deadline_duration set on {len(values)} rows")
