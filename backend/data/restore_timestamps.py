"""One-off: restore legacy timestamps that auto_now_add/auto_now overwrote during import.

Run: python manage.py shell < /app/data/restore_timestamps.py
"""

from datetime import datetime, timezone as dt_timezone

from django.db import connection
from psycopg2.extras import execute_values

from apps.core.legacy_import.sql_dump import load_sql_file, parse_insert_rows

SPLIT = "/app/data/split"

# v3 table → (split file, source table name, {legacy col → v3 col})
RESTORES = {
    "suspects": ("suspects.sql", "suspects", {"created_at": "created_at", "modified_at": "updated_at"}),
    "suspectcase": ("suspectcase.sql", "suspectcase", {"created_at": "created_at"}),
    "damiinada": ("damiinada.sql", "damiinada", {"created_at": "created_at"}),
    "suspectresponse": ("suspectresponse.sql", "suspectresponse", {"created_at": "created_at", "modified_at": "modified_at"}),
    "responsecomments": ("responsecomments.sql", "responsecomments", {"created_at": "created_at", "modified_at": "modified_at"}),
    "commentsreply": ("commentsreply.sql", "commentsreply", {"created_at": "created_at", "modified_at": "modified_at"}),
    "notices": ("notices.sql", "notices", {"created_at": "created_at", "modified_at": "modified_at"}),
    "audit_trails": ("audit_trails.sql", "audit_trails", {"date_of_event": "created_at"}),
    "error_logs": ("error_logs.sql", "error_logs", {"date_recorded": "created_at"}),
    "dhacdooyinka": ("dhacdooyinka.sql", "dhacdooyinka", {"date_recorded": "date_recorded"}),
    "dhibanayaashas": ("dhibanayaashas.sql", "dhibanayaashas", {"date_recorded": "date_recorded", "updated_at": "updated_at"}),
    "dhibane_documents": ("dhibane_documents.sql", "dhibane_documents", {"date_recorded": "date_recorded", "date_modified": "date_modified"}),
    "cars": ("cars.sql", "cars", {"created_at": "created_at", "modified_at": "modified_at"}),
    "task": ("task.sql", "task", {"created_at": "created_at", "modified_at": "modified_at"}),
    "cabashadaappka": ("cabashadaappka.sql", "cabashadaappka", {"created_at": "created_at", "modified_at": "modified_at"}),
    "suspectcarmodal": ("suspectcarmodal.sql", "suspectcarmodal", {"created_at": "created_at", "modified_at": "modified_at"}),
    "user_location": ("user_location.sql", "user_location", {"last_updated": "last_updated"}),
    "user_devices": ("userdevices.sql", "userdevices", {"created_at": "created_at", "updated_at": "updated_at"}),
    "disarmament_records": ("hubkadhigis.sql", "hubkadhigis", {"date_recorded": "created_at", "update_at": "updated_at"}),
    "disarmament_images": ("hubkadhigis_images.sql", "hubkadhigis_images", {"created_at": "created_at"}),
    "noocadhacdooyinkaguud": ("nooca_feejignaantas.sql", "nooca_feejignaantas", {"created_at": "created_at", "update_at": "update_at"}),
    "noocyada_dhacdooyinka": ("noocyada_dhacdooyinka.sql", "noocyada_dhacdooyinka", {"date_recorded": "date_recorded", "created_at": "created_at", "update_at": "update_at"}),
    "surveys_response": ("surveys_response.sql", "surveys_response", {"submitted_at": "submitted_at"}),
}


def parse_dt(value):
    if value in (None, "", "NULL"):
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=dt_timezone.utc)
        except ValueError:
            continue
    return None


def restore(table, filename, source, colmap):
    rows = parse_insert_rows(load_sql_file(f"{SPLIT}/{filename}"), source)
    values = []
    for row in rows:
        pk = row.get("id") or row.get("audit_id") or row.get("error_no")
        if pk in (None, ""):
            continue
        dts = [parse_dt(row.get(src)) for src in colmap]
        if all(d is None for d in dts):
            continue
        values.append((int(pk), *dts))
    if not values:
        print(f"{table}: nothing to restore")
        return

    targets = list(colmap.values())
    set_clause = ", ".join(f'"{dst}" = COALESCE(v.{dst}, t."{dst}")' for dst in targets)
    cols = ", ".join(["id"] + targets)
    sql = (
        f'UPDATE "{table}" t SET {set_clause} '
        f"FROM (VALUES %s) AS v({cols}) WHERE t.id = v.id"
    )
    template = "(" + ", ".join(["%s"] + ["%s::timestamptz"] * len(targets)) + ")"
    with connection.cursor() as c:
        execute_values(c.cursor, sql, values, template=template, page_size=5000)
    print(f"{table}: restored {len(values)} rows ({', '.join(targets)})")


for table, (filename, source, colmap) in RESTORES.items():
    restore(table, filename, source, colmap)

# Survey deadline: legacy deadline_date (absolute) → v3 deadline_duration (interval from submitted_at)
rows = parse_insert_rows(load_sql_file(f"{SPLIT}/surveys_response.sql"), "surveys_response")
values = []
for row in rows:
    pk = row.get("id")
    submitted = parse_dt(row.get("submitted_at"))
    deadline = parse_dt(row.get("deadline_date"))
    if pk in (None, "") or submitted is None or deadline is None:
        continue
    values.append((int(pk), deadline - submitted))
if values:
    with connection.cursor() as c:
        execute_values(
            c.cursor,
            "UPDATE surveys_response t SET deadline_duration = v.d "
            "FROM (VALUES %s) AS v(id, d) WHERE t.id = v.id",
            values,
            template="(%s, %s::interval)",
            page_size=5000,
        )
print(f"surveys_response: deadline_duration set on {len(values)} rows")
