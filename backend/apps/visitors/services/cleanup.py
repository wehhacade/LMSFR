"""One-time / re-runnable cleanup for false return histories from placeholder NIRA merges."""

from __future__ import annotations

from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from apps.visitors.models import Visit, Visitor
from apps.visitors.nira import is_matchable_nira

HIDDEN_SINK_NAME = "System Unassigned (hidden)"


def get_or_create_hidden_sink() -> Visitor:
    sink = Visitor.objects.filter(is_hidden=True, full_name=HIDDEN_SINK_NAME).order_by("id").first()
    if sink:
        return sink
    return Visitor.objects.create(
        full_name=HIDDEN_SINK_NAME,
        mother_name="",
        gender="",
        phone="",
        nira="",
        visited_at=timezone.now(),
        verified=False,
        is_hidden=True,
    )


@transaction.atomic
def cleanup_bloated_placeholder_profiles(*, dry_run: bool = False) -> dict:
    """
    Flow C: keep latest visit + current person data on bloated placeholder profiles;
    move older visits onto one hidden sink (not shown in list/UI).

    Does not erase the stored NIRA input — only identity matching ignores placeholders.
    Also absorbs leftover "Booqade" stubs.
    """
    sink = None if dry_run else get_or_create_hidden_sink()
    profiles_cleaned = 0
    visits_moved = 0
    stubs_absorbed = 0

    # Un-merge false return stacks: non-matchable NIRA with >1 visits.
    candidates = (
        Visitor.objects.filter(is_hidden=False)
        .annotate(visit_total=Count("visits"))
        .filter(visit_total__gt=1)
        .order_by("id")
    )
    for visitor in candidates:
        if is_matchable_nira(visitor.nira):
            continue
        visits = list(
            Visit.objects.filter(visitor_id=visitor.id).order_by("-visited_at", "-id")
        )
        if len(visits) <= 1:
            continue
        latest = visits[0]
        older = visits[1:]
        visits_moved += len(older)
        profiles_cleaned += 1
        if dry_run:
            continue
        assert sink is not None
        Visit.objects.filter(pk__in=[v.id for v in older]).update(visitor_id=sink.id)
        visitor.visited_at = latest.visited_at
        visitor.verified = bool(latest.verified)
        visitor.save(update_fields=["visited_at", "verified"])

    # Absorb leftover Booqade stubs from migration 0007 into the sink (no list spam).
    stubs = Visitor.objects.filter(
        is_hidden=False,
        full_name__startswith="Booqade (NIRA la'aan)",
    )
    for stub in stubs:
        stubs_absorbed += 1
        if dry_run:
            continue
        assert sink is not None
        Visit.objects.filter(visitor_id=stub.id).update(visitor_id=sink.id)
        stub.delete()

    if sink is not None and not dry_run:
        latest_sink = Visit.objects.filter(visitor_id=sink.id).order_by("-visited_at", "-id").first()
        if latest_sink:
            sink.visited_at = latest_sink.visited_at
            sink.verified = bool(latest_sink.verified)
            sink.save(update_fields=["visited_at", "verified"])

    return {
        "profiles_cleaned": profiles_cleaned,
        "visits_moved": visits_moved,
        "stubs_absorbed": stubs_absorbed,
        "sink_id": None if dry_run or sink is None else sink.id,
        "dry_run": dry_run,
    }
