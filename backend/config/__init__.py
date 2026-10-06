"""Ensure Celery app is loaded with Django (shared_task → correct broker)."""

from .celery import app as celery_app

__all__ = ("celery_app",)
