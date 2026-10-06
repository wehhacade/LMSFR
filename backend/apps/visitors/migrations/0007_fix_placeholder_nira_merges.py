from django.db import migrations
from django.db.models import Count


def _normalize_visitor_nira(value: str | None) -> str:
    text = (str(value) if value is not None else "").strip()
    if not text:
        return ""
    if text.lower() in {"null", "none", "nil", "n/a", "na", "-", "--", "unknown", "undefined"}:
        return ""
    if text.isdigit() and set(text) <= {"0"}:
        return ""
    return text


def fix_placeholder_nira_merges(apps, schema_editor):
    """
    Clear placeholder NIRAs (0 / 00 / …) and un-merge false return histories.

    Keep the latest visit on the current person record; move older visits onto
    separate stub visitors so they no longer inflate Returned ×N.
    """
    Visitor = apps.get_model("visitors", "Visitor")
    Visit = apps.get_model("visitors", "Visit")

    candidates = (
        Visitor.objects.exclude(nira="")
        .annotate(visit_total=Count("visits"))
        .order_by("id")
    )
    for visitor in candidates.iterator():
        if _normalize_visitor_nira(visitor.nira) != "":
            continue

        visits = list(
            Visit.objects.filter(visitor_id=visitor.id).order_by("-visited_at", "-id")
        )
        if len(visits) > 1:
            latest = visits[0]
            for visit in visits[1:]:
                stamp = visit.visited_at.strftime("%Y-%m-%d %H:%M") if visit.visited_at else str(visit.id)
                stub = Visitor.objects.create(
                    full_name=f"Booqade (NIRA la'aan) · {stamp}",
                    mother_name="",
                    gender="",
                    phone="",
                    nira="",
                    visited_at=visit.visited_at,
                    verified=bool(visit.verified),
                    created_by_id=visit.created_by_id,
                )
                Visit.objects.filter(pk=visit.id).update(visitor_id=stub.id)

            visitor.visited_at = latest.visited_at
            visitor.verified = bool(latest.verified)

        visitor.nira = ""
        visitor.save(update_fields=["nira", "visited_at", "verified"])


def noop_reverse(apps, schema_editor):
    # Irreversible data repair.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("visitors", "0006_seed_xabsiga_dhexe"),
    ]

    operations = [
        migrations.RunPython(fix_placeholder_nira_merges, noop_reverse),
    ]
