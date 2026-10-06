"""HRM employee tree lookup (Ilaalo-shacab). Graceful when env is unset."""

from __future__ import annotations

import logging
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def hrm_configured() -> bool:
    return bool(getattr(settings, "HRM_EMPLOYEE_TREE_URL", "") and getattr(settings, "HRM_TOKEN", "") and getattr(settings, "HRM_USER_ID", ""))


def _parse_results(payload: Any) -> list[dict]:
    if not isinstance(payload, dict):
        return []
    message = payload.get("message") or payload.get("Message") or {}
    if isinstance(message, dict):
        results = message.get("results") or []
        return results if isinstance(results, list) else []
    return []


def _normalize_employee(row: dict) -> dict:
    employee_id = str(row.get("employee_id") or row.get("EmployeeId") or row.get("id") or "").strip()
    phone = str(row.get("phone") or row.get("Phone") or row.get("mobile") or "").strip()
    name = str(
        row.get("full_name")
        or row.get("FullName")
        or row.get("name")
        or row.get("Name")
        or ""
    ).strip()
    status = str(row.get("status") or row.get("Status") or row.get("employee_status") or "").strip()
    position = str(row.get("position") or row.get("Position") or row.get("job_title") or "").strip()
    department = str(row.get("department") or row.get("Department") or "").strip()
    return {
        "employee_id": employee_id,
        "name": name,
        "phone": phone,
        "status": status,
        "position": position,
        "department": department,
        "is_active": status.lower() in ("active", "firfircoon", "1", "true", "") if status else True,
        "raw": row,
    }


def fetch_hrm_employees(search_query: str) -> tuple[list[dict], str | None]:
    """Return (employees, error_message). Empty list + None means no matches."""
    if not hrm_configured():
        return [], "HRM is not configured on this server."

    url = settings.HRM_EMPLOYEE_TREE_URL
    token = settings.HRM_TOKEN
    try:
        user_id = int(settings.HRM_USER_ID)
    except (TypeError, ValueError):
        return [], "HRM user_id must be a valid number."

    timeout = int(getattr(settings, "HRM_TIMEOUT", 15))
    verify = bool(getattr(settings, "HRM_VERIFY_SSL", False))

    try:
        response = requests.post(
            url,
            json={
                "token": token,
                "user_id": user_id,
                "SearchQuery": str(search_query or ""),
            },
            timeout=timeout,
            verify=verify,
        )
    except requests.RequestException:
        logger.warning("HRM service unavailable", exc_info=True)
        return [], "HRM service is unavailable. Fadlan isku day mar kale."

    try:
        payload = response.json()
    except ValueError:
        return [], "HRM returned an invalid response."

    if response.status_code >= 400:
        return [], "HRM request failed."

    return [_normalize_employee(row) for row in _parse_results(payload) if isinstance(row, dict)], None


def parse_search_terms(raw: str) -> list[str]:
    parts: list[str] = []
    for chunk in (raw or "").replace(",", "\n").splitlines():
        term = chunk.strip()
        if term and term not in parts:
            parts.append(term)
    return parts[:50]
