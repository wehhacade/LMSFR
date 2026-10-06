from django.db import migrations
from django.db.models import Count
from django.utils import timezone


HIDDEN_SINK_NAME = "System Unassigned (hidden)"

_PLACEHOLDER_TOKENS = frozenset(
    {
        "null",
        "none",
        "nil",
        "n/a",
        "na",
        "-",
        "--",
        "unknown",
        "undefined",
    }
)
MIN_MATCHABLE_NIRA_LEN = 6


def _normalize_visitor_nira(value: str | None) -> str:
    text = (str(value) if value is not None else "").strip()
    if not text:
        return ""
    if text.lower() in _PLACEHOLDER_TOKENS:
        return ""
    if text.isdigit() and set(text) <= {"0"}:
        return ""
    if len(text) < MIN_MATCHABLE_NIRA_LEN:
        return ""
    return text


def cleanup_with_hidden_sink(apps, schema_editor):
    Visitor = apps.get_model("visitors", "Visitor")
    Visit = apps.get_model("visitors", "Visit")

    sink = Visitor.objects.filter(is_hidden=True, full_name=HIDDEN_SINK_NAME).order_by("id").first()
    if not sink:
        sink = Visitor.objects.create(
            full_name=HIDDEN_SINK_NAME,
            mother_name="",
            gender="",
            phone="",
            nira="",
            visited_at=timezone.now(),
            verified=False,
            is_hidden=True,
        )

    for visitor in Visitor.objects.filter(is_hidden=False).exclude(nira="").iterator():
        if _normalize_visitor_nira(visitor.nira) != "":
            continue
        visitor.nira = ""
        visitor.save(update_fields=["nira"])

    candidates = (
        Visitor.objects.filter(is_hidden=False, nira="")
        .annotate(visit_total=Count("visits"))
        .filter(visit_total__gt=1)
        .order_by("id")
    )
    for visitor in candidates:
        visits = list(
            Visit.objects.filter(visitor_id=visitor.id).order_by("-visited_at", "-id")
        )
        if len(visits) <= 1:
            continue
        latest = visits[0]
        older_ids = [v.id for v in visits[1:]]
        Visit.objects.filter(pk__in=older_ids).update(visitor_id=sink.id)
        visitor.visited_at = latest.visited_at
        visitor.verified = bool(latest.verified)
        visitor.nira = ""
        visitor.save(update_fields=["visited_at", "verified", "nira"])

    stubs = Visitor.objects.filter(
        is_hidden=False,
        full_name__startswith="Booqade (NIRA la'aan)",
    )
    for stub in stubs:
        Visit.objects.filter(visitor_id=stub.id).update(visitor_id=sink.id)
        stub.delete()

    latest_sink = Visit.objects.filter(visitor_id=sink.id).order_by("-visited_at", "-id").first()
    if latest_sink:
        sink.visited_at = latest_sink.visited_at
        sink.verified = bool(latest_sink.verified)
        sink.save(update_fields=["visited_at", "verified"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("visitors", "0008_visitor_is_hidden_cleanup_sink"),
    ]

    operations = [
        migrations.RunPython(cleanup_with_hidden_sink, noop_reverse),
    ]
