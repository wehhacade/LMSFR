"""One-off: import legacy Surveys_answer_choices M2M rows (run via manage.py shell)."""

from django.db import connection

from apps.core.legacy_import.sql_dump import load_sql_file, parse_insert_rows
from apps.surveys.models import Answer, Choice

rows = parse_insert_rows(load_sql_file("/app/data/split/surveys_answer_choices.sql"), "surveys_answer_choices")
print(f"Parsed {len(rows)} rows")

answer_ids = set(Answer.objects.values_list("pk", flat=True))
choice_ids = set(Choice.objects.values_list("pk", flat=True))

batch = []
skipped = 0
max_id = 0
for row in rows:
    pk, answer_id, choice_id = row.get("id"), row.get("answer_id"), row.get("choice_id")
    if not pk or answer_id not in answer_ids or choice_id not in choice_ids:
        skipped += 1
        continue
    max_id = max(max_id, int(pk))
    batch.append((int(pk), int(answer_id), int(choice_id)))

with connection.cursor() as c:
    c.execute("SELECT to_regclass('surveys_answer_choices')")
    table = c.fetchone()[0]
    assert table, "surveys_answer_choices table not found"
    c.executemany(
        'INSERT INTO surveys_answer_choices ("id", "answer_id", "choice_id") VALUES (%s, %s, %s) '
        "ON CONFLICT (id) DO NOTHING",
        batch,
    )
    if max_id:
        c.execute("SELECT setval(pg_get_serial_sequence('surveys_answer_choices', 'id'), %s, true)", [max_id])

print(f"Inserted {len(batch)}, skipped {skipped}, max_id {max_id}")
