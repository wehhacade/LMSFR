"""NIRA storage vs identity matching for visitors."""

from __future__ import annotations

# App flow:
# - Switch "Do you have NIRA?" = No  → send null / omit / ""
# - Switch = Yes → send a real matchable NIRA (never 0 / 08 / junk)
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

# Real Somali NIRA numbers are long; anything shorter is not a stable identity key.
MIN_MATCHABLE_NIRA_LEN = 6
_MAX_STORED_NIRA_LEN = 100

INVALID_NIRA_MESSAGE = (
    "NIRA sax ah geli, ama dooro 'Maya' haddii uusan lahayn NIRA "
    "(ha dirin 0 / 00 / 08)."
)


class InvalidVisitorNira(ValueError):
    """Submitted NIRA is present but not a usable identity key."""


def store_visitor_nira(value: str | None) -> str:
    """Trim client input for storage (empty when null / omitted)."""
    if value is None:
        return ""
    return str(value).strip()[:_MAX_STORED_NIRA_LEN]


def normalize_visitor_nira(value: str | None) -> str:
    """Return a usable identity key, or "" for missing / placeholder / too-short values."""
    text = store_visitor_nira(value)
    if not text:
        return ""
    if text.lower() in _PLACEHOLDER_TOKENS:
        return ""
    # Pure zeros from older app builds mean "no NIRA".
    if text.isdigit() and set(text) <= {"0"}:
        return ""
    # Weak / junk values like "8", "08", "88" must not merge people.
    if len(text) < MIN_MATCHABLE_NIRA_LEN:
        return ""
    return text


def is_matchable_nira(value: str | None) -> bool:
    return bool(normalize_visitor_nira(value))


def validate_submitted_nira(value: str | None) -> str:
    """
    App switch rules:
    - No NIRA → null/empty → store ""
    - Has NIRA → must be matchable
    - Temporary old-app: only exact "0" means no NIRA → store ""
    - Reject other junk: 00, 08, 88, short values, etc.
    """
    stored = store_visitor_nira(value)
    if not stored:
        return ""
    # Old app sends exactly "0" when the person has no NIRA.
    if stored == "0":
        return ""
    if not is_matchable_nira(stored):
        raise InvalidVisitorNira(INVALID_NIRA_MESSAGE)
    return stored
