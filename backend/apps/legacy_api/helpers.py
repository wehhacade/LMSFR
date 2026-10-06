"""Shared helpers for old /APIs response shape."""

from __future__ import annotations

from functools import wraps

from rest_framework import status
from rest_framework.response import Response


def legacy_ok(message, *, status_code=status.HTTP_200_OK):
    if isinstance(message, dict) and "isError" in message:
        return Response(message, status=status_code)
    return Response({"Message": message, "isError": False}, status=status_code)


def legacy_err(text: str, *, status_code=status.HTTP_200_OK):
    return Response(
        {
            "isError": True,
            "title": "Server Error",
            "type": "error",
            "Message": text,
        },
        status=status_code,
    )


def legacy_validation(text: str):
    return Response(
        {"isError": True, "title": "Validation", "type": "warning", "Message": text},
        status=status.HTTP_200_OK,
    )


def legacy_catch(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        try:
            return view(request, *args, **kwargs)
        except Exception as exc:  # noqa: BLE001 — old APIs always return 200 JSON
            return legacy_err(f"On Error Occurs. {exc}. Please try again or contact system administrator")

    return wrapper
