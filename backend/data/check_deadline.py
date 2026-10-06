from apps.core.legacy_import.sql_dump import load_sql_file, parse_insert_rows

rows = parse_insert_rows(load_sql_file("/app/data/split/surveys_response.sql"), "surveys_response")
n = 0
samples = []
for r in rows:
    v = r.get("deadline_date")
    if v not in (None, ""):
        n += 1
        if len(samples) < 5:
            samples.append((r.get("id"), v, r.get("submitted_at")))
print("rows with deadline_date:", n)
print("samples:", samples)
