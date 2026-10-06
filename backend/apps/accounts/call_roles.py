"""Walkie / call-commander roles on existing UserType names (no new user fields)."""

from __future__ import annotations

TALIYE_DEGMO = "taliye_degmo"
TALIYE = "taliye"
XOGHAYE = "xoghaye"
TALIYE_QEBEED = "taliye_qebeed"
CALL_ALL_TYPES = frozenset({TALIYE, XOGHAYE})
CALL_OWN_TYPES = frozenset({TALIYE_DEGMO})
CALL_QEBEED_TYPES = frozenset({TALIYE_QEBEED})
CALL_COMMANDER_TYPES = CALL_ALL_TYPES | CALL_OWN_TYPES | CALL_QEBEED_TYPES


def _type_name(user) -> str:
    ut = getattr(user, "user_type", None)
    return (getattr(ut, "name", None) or "").strip().lower()


def is_dev(user) -> bool:
    if getattr(user, "is_superuser", False):
        return True
    return _type_name(user) == "dev"


def is_taliye_degmo(user) -> bool:
    return _type_name(user) == TALIYE_DEGMO


def is_taliye_all(user) -> bool:
    return _type_name(user) in CALL_ALL_TYPES


def is_taliye_qebeed(user) -> bool:
    return _type_name(user) == TALIYE_QEBEED


def qeyb_county_ids(user) -> list[int]:
    """Counties linked to the caller's department (qeyb)."""
    dept = getattr(user, "department", None)
    if dept is None:
        return []
    try:
        return list(dept.counties.values_list("id", flat=True))
    except Exception:
        return []


def call_scope(user) -> str:
    if is_dev(user) or is_taliye_all(user):
        return "all"
    if is_taliye_qebeed(user):
        return "qeyb"
    if is_taliye_degmo(user):
        return "own"
    return "none"


def can_broadcast(user) -> bool:
    return (
        is_dev(user)
        or is_taliye_degmo(user)
        or is_taliye_all(user)
        or is_taliye_qebeed(user)
    )
