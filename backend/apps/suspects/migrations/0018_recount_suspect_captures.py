"""Rebuild bail_count so it reflects captures, not damiin edits."""

from django.db import migrations
from django.db.models import Count, Q


def recount_captures(apps, schema_editor):
    Suspect = apps.get_model("suspects", "Suspect")
    rows = (
        Suspect.objects.annotate(
            total_cases=Count("cases", distinct=True),
            damiin_cases=Count("cases", filter=Q(cases__damiin__isnull=False), distinct=True),
        )
        .values("pk", "bail_count", "total_cases", "damiin_cases")
        .iterator(chunk_size=2000)
    )
    updates = []
    for row in rows:
        captures = row["damiin_cases"] or row["total_cases"]
        if captures != row["bail_count"]:
            updates.append(Suspect(pk=row["pk"], bail_count=captures))
        if len(updates) >= 2000:
            Suspect.objects.bulk_update(updates, ["bail_count"])
            updates = []
    if updates:
        Suspect.objects.bulk_update(updates, ["bail_count"])


class Migration(migrations.Migration):
    dependencies = [
        ("suspects", "0017_suspect_source_suspect_suspects_source_551208_idx"),
    ]

    operations = [
        migrations.RunPython(recount_captures, migrations.RunPython.noop),
    ]
