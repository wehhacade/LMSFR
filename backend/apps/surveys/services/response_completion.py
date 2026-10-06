"""Completion filtering without model fields — cached complete PK sets."""

from __future__ import annotations

import hashlib

from django.core.cache import cache
from django.db.models import QuerySet

from apps.core.cache import MEDIUM, make_cache_key
from apps.surveys.models import Response
from apps.surveys.queries import (
    COMPLETE_Q,
    annotate_list_completion,
    response_list_filter_qs,
)

COMPLETE_PKS_PREFIX = "survey.responses.complete_pks"


def _filter_digest(
    *,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    county_id: str = "",
) -> str:
    raw = "|".join(
        f"{key}={value}"
        for key, value in (
            ("survey_id", survey_id),
            ("search", search),
            ("date_from", date_from),
            ("date_to", date_to),
            ("county_id", county_id),
        )
    )
    return hashlib.md5(raw.encode(), usedforsecurity=False).hexdigest()  # noqa: S324


def get_complete_response_pks(
    *,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    county_id: str = "",
) -> list[int]:
    """Cached list of complete response primary keys for the active filter set."""
    digest = _filter_digest(
        survey_id=survey_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        county_id=county_id,
    )
    key = make_cache_key(COMPLETE_PKS_PREFIX, digest)
    cached = cache.get(key)
    if cached is not None:
        return cached

    base = response_list_filter_qs(
        survey_id=survey_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        county_id=county_id,
    )
    pks = list(
        annotate_list_completion(base)
        .filter(COMPLETE_Q)
        .values_list("pk", flat=True)[:50_000]
    )
    cache.set(key, pks, MEDIUM)
    return pks


def apply_completion_status_by_pks(
    qs: QuerySet[Response],
    completion_status: str,
    *,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    county_id: str = "",
) -> QuerySet[Response]:
    """Filter by cached PK set — avoids per-row completion subqueries on huge tables."""
    if not completion_status:
        return qs

    complete_pks = get_complete_response_pks(
        survey_id=survey_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        county_id=county_id,
    )
    if completion_status == "complete":
        if not complete_pks:
            return qs.none()
        return qs.filter(pk__in=complete_pks)
    if not complete_pks:
        return qs
    return qs.exclude(pk__in=complete_pks)


def count_responses_with_completion(
    *,
    survey_id: str = "",
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    completion_status: str = "",
    county_id: str = "",
    deadline_status: str = "",
) -> int:
    from apps.surveys.queries import apply_deadline_status_filter

    base = response_list_filter_qs(
        survey_id=survey_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        county_id=county_id,
    )
    base = apply_deadline_status_filter(base, deadline_status)
    if not completion_status:
        return base.values("pk").count()

    complete_pks = get_complete_response_pks(
        survey_id=survey_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        county_id=county_id,
    )
    if completion_status == "complete":
        if not complete_pks:
            return 0
        return base.filter(pk__in=complete_pks).values("pk").count()
    if not complete_pks:
        return base.values("pk").count()
    return base.exclude(pk__in=complete_pks).values("pk").count()
