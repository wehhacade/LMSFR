"""Import surveys_answer_choices M2M through rows."""

from __future__ import annotations

from django.db import transaction

from apps.surveys.models import Answer, Choice


def import_surveys_answer_choices(
    rows: list[dict],
    *,
    truncate: bool = False,
    batch_size: int = 500,
) -> dict:
    Through = Answer.choices.through
    if truncate:
        Through.objects.all().delete()

    valid_answers = set(Answer.objects.values_list("pk", flat=True))
    valid_choices = set(Choice.objects.values_list("pk", flat=True))
    batch_size = max(50, batch_size)
    created = skipped = 0
    to_create: list = []
    seen: set[tuple[int, int]] = set()
    if not truncate:
        seen = set(Through.objects.values_list("answer_id", "choice_id"))

    with transaction.atomic():
        for row in rows:
            try:
                aid = int(row["answer_id"])
                cid = int(row["choice_id"])
            except (KeyError, TypeError, ValueError):
                skipped += 1
                continue
            if aid not in valid_answers or cid not in valid_choices:
                skipped += 1
                continue
            key = (aid, cid)
            if key in seen:
                skipped += 1
                continue
            seen.add(key)
            to_create.append(Through(answer_id=aid, choice_id=cid))
            created += 1
            if len(to_create) >= batch_size:
                Through.objects.bulk_create(to_create, batch_size=batch_size, ignore_conflicts=True)
                to_create.clear()

        if to_create:
            Through.objects.bulk_create(to_create, batch_size=batch_size, ignore_conflicts=True)

    return {
        "created": created,
        "updated": 0,
        "skipped": skipped,
        "max_id": None,
        "model": "surveys.Answer.choices",
    }
