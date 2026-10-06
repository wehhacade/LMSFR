"""Resolve legacy integer IDs for County / SubCounty / Country."""

from __future__ import annotations

from apps.accounts.models import Country, County, SubCounty


def resolve_county(raw) -> County | None:
    if raw in (None, "", 0, "0"):
        return None
    text = str(raw).strip()
    try:
        return County.objects.filter(pk=int(text)).only("id").first()
    except (TypeError, ValueError):
        return None


def resolve_sub_county(raw, *, county: County | None = None) -> SubCounty | None:
    if raw in (None, "", 0, "0"):
        return None
    text = str(raw).strip()
    try:
        pk = int(text)
    except (TypeError, ValueError):
        return None
    row = SubCounty.objects.filter(pk=pk).only("id", "county_id").first()
    if row and county and row.county_id != county.id:
        return None
    return row


def resolve_country(raw) -> Country | None:
    if raw in (None, "", 0, "0"):
        return None
    text = str(raw).strip()
    try:
        return Country.objects.filter(pk=int(text)).only("id").first()
    except (TypeError, ValueError):
        return Country.objects.filter(name__iexact=text).only("id").first()
