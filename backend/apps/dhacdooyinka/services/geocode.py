"""Reverse-geocode incident GPS into a human-readable place name."""

from __future__ import annotations

import json
import logging
import re
import urllib.error
import urllib.parse
import urllib.request

from django.core.cache import cache

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "LMSBR/1.0 (dhacdooyinka reverse geocode; https://lmsbr.com)"
CACHE_TTL = 60 * 60 * 24 * 30
COORD_PAIR_RE = re.compile(
    r"^\s*(-?\d+(?:\.\d+)?)\s*[,/]\s*(-?\d+(?:\.\d+)?)\s*$"
)
ARABIC_RE = re.compile(r"[\u0600-\u06FF]+")
GENERIC_TARGETS = {
    "banaadir",
    "baanadir",
    "banadir",
    "somalia",
    "soomaaliya",
    "muqdisho",
    "mogadishu",
}

ADDRESS_KEYS = (
    "road",
    "pedestrian",
    "neighbourhood",
    "suburb",
    "quarter",
    "village",
    "town",
    "city_district",
    "city",
    "county",
    "state",
)


def parse_coords(lat, lng) -> tuple[float, float] | None:
    try:
        la = float(str(lat).strip())
        lo = float(str(lng).strip())
    except (TypeError, ValueError, AttributeError):
        return None
    if abs(la) < 0.01 and abs(lo) < 0.01:
        return None
    if not (0.5 <= la <= 13.0 and 40.0 <= lo <= 52.0):
        return None
    return la, lo


def looks_like_coords(value: str | None) -> bool:
    text = (value or "").strip()
    if not text:
        return False
    match = COORD_PAIR_RE.match(text)
    if match:
        return parse_coords(match.group(1), match.group(2)) is not None
    try:
        float(text)
        return True
    except ValueError:
        return False


def _latin_label(value: str | None) -> str:
    text = ARABIC_RE.sub(" ", value or "")
    text = re.sub(r"\s+", " ", text).strip(" ,-")
    return text


def _format_nominatim_address(payload: dict) -> str:
    address = payload.get("address") if isinstance(payload.get("address"), dict) else {}
    parts: list[str] = []
    poi = _latin_label(payload.get("name") if isinstance(payload.get("name"), str) else "")
    if poi:
        parts.append(poi)
    for key in ADDRESS_KEYS:
        label = _latin_label(address.get(key) if isinstance(address.get(key), str) else "")
        if not label:
            continue
        if label.lower() in {"somalia", "soomaaliya"}:
            continue
        if label.lower() in {p.lower() for p in parts}:
            continue
        parts.append(label)
        if len(parts) >= 3:
            break
    if parts:
        return ", ".join(parts)
    display = _latin_label(payload.get("display_name") if isinstance(payload.get("display_name"), str) else "")
    display = re.sub(r",?\s*(Soomaaliya|Somalia)\s*$", "", display, flags=re.I).strip(" ,")
    return display


def reverse_geocode_name(lat, lng) -> str:
    coords = parse_coords(lat, lng)
    if not coords:
        return ""
    la, lo = coords
    cache_key = f"geo:rev:{la:.5f}:{lo:.5f}"
    cached = cache.get(cache_key)
    if isinstance(cached, str):
        return cached

    query = urllib.parse.urlencode({
        "format": "jsonv2",
        "lat": f"{la:.6f}",
        "lon": f"{lo:.6f}",
        "zoom": 18,
        "addressdetails": 1,
    })
    request = urllib.request.Request(
        f"{NOMINATIM_URL}?{query}",
        headers={"User-Agent": USER_AGENT, "Accept-Language": "en,so"},
    )
    try:
        with urllib.request.urlopen(request, timeout=3.5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        logger.info("Reverse geocode failed for %s,%s: %s", la, lo, exc)
        cache.set(cache_key, "", 60 * 15)
        return ""

    name = _format_nominatim_address(payload if isinstance(payload, dict) else {})
    cache.set(cache_key, name, CACHE_TTL)
    return name


def target_location_name(obj) -> str:
    """Human-readable target/location for a dhacdo — never raw GPS digits."""
    bartil = (getattr(obj, "bartilmaameedka_dhacdada", None) or "").strip()
    admin_parts = [
        obj.gobolka.name if getattr(obj, "gobolka", None) else None,
        obj.degmada.name if getattr(obj, "degmada", None) else None,
        obj.waaxda.name if getattr(obj, "waaxda", None) else None,
        obj.laanta.name if getattr(obj, "laanta", None) else None,
    ]
    admin_name = ", ".join(p.strip() for p in admin_parts if p and str(p).strip())

    specific = bartil and not looks_like_coords(bartil) and bartil.lower() not in GENERIC_TARGETS
    if specific and bartil.lower() not in {p.strip().lower() for p in admin_parts if p}:
        return bartil

    geo_name = reverse_geocode_name(getattr(obj, "latitude", None), getattr(obj, "longitude", None))
    if geo_name:
        return geo_name
    if specific:
        return bartil
    if admin_name:
        return admin_name
    if bartil and not looks_like_coords(bartil):
        return bartil
    return ""
