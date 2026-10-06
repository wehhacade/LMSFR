from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone


class Visitor(models.Model):
    """Person who visits — one row per identity (usually keyed by NIRA)."""

    class Gender(models.TextChoices):
        MALE = "m", "Male"
        FEMALE = "f", "Female"
        OTHER = "other", "Other"
        UNKNOWN = "", "Unknown"

    full_name = models.CharField(max_length=500, db_index=True)
    mother_name = models.CharField(max_length=500, blank=True)
    gender = models.CharField(
        max_length=16,
        blank=True,
        default="",
        db_index=True,
        help_text="From NIRA sex field when available (m/f).",
    )
    phone = models.CharField(max_length=50, blank=True, db_index=True)
    nira = models.CharField(max_length=100, blank=True, db_index=True)
    # Denormalized from latest Visit for list/filter performance.
    visited_at = models.DateTimeField(default=timezone.now, db_index=True)
    verified = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Latest visit verified flag.",
    )
    is_hidden = models.BooleanField(
        default=False,
        db_index=True,
        help_text="System sink / unassigned rows — excluded from staff list and profiles.",
    )
    image = models.ImageField(upload_to="uploads/visitors/", blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="visitors_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "visitors"
        ordering = ["-visited_at", "-id"]
        indexes = [
            models.Index(fields=["visited_at", "verified"]),
            models.Index(fields=["full_name", "phone"]),
            models.Index(fields=["is_hidden", "visited_at"], name="visitors_is_hidden_visited_idx"),
        ]
        constraints = [
            # Real NIRA must be unique (case-insensitive). Empty / short / all-zero allowed many times.
            models.UniqueConstraint(
                Lower("nira"),
                condition=(
                    Q(is_hidden=False)
                    & ~Q(nira="")
                    & ~Q(nira__regex=r"^[0]+$")
                    & Q(nira__regex=r"^.{6,}$")
                ),
                name="visitors_unique_matchable_nira",
            ),
        ]

    def __str__(self) -> str:
        return self.full_name or f"Visitor {self.pk}"

    @property
    def visit_count(self) -> int:
        return self.visits.count()


class VisitDestination(models.Model):
    """Places a visitor may be sent to. Managed later from Django admin."""

    name = models.CharField(max_length=200, unique=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "visitor_destinations"
        ordering = ["sort_order", "id"]
        verbose_name = "visit destination"
        verbose_name_plural = "visit destinations"

    def __str__(self) -> str:
        return self.name


class VisitAllegation(models.Model):
    """Configurable allegation categories for visitor records."""

    name = models.CharField(max_length=200, unique=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "visitor_allegations"
        ordering = ["sort_order", "id"]
        verbose_name = "visit allegation"
        verbose_name_plural = "visit allegations"

    def __str__(self) -> str:
        return self.name


class Visit(models.Model):
    """One physical visit event for a Visitor (history / return visits)."""

    visitor = models.ForeignKey(
        Visitor,
        on_delete=models.CASCADE,
        related_name="visits",
    )
    visiting = models.CharField(
        max_length=500,
        help_text="Who / where they are visiting (required on new visits).",
    )
    contact_name = models.CharField(
        max_length=500,
        blank=True,
        help_text="Three-part name of the person being visited.",
    )
    relationship = models.CharField(
        max_length=200,
        blank=True,
        help_text="Visitor's relationship to the person being visited.",
    )
    allegation = models.ForeignKey(
        VisitAllegation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="visits",
    )
    sentence = models.TextField(
        blank=True,
        help_text="Sentence or judgment imposed.",
    )
    visited_at = models.DateTimeField(default=timezone.now, db_index=True)
    verified = models.BooleanField(default=False, db_index=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="visitor_visits_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "visitor_visits"
        ordering = ["-visited_at", "-id"]
        indexes = [
            models.Index(fields=["visited_at", "verified"]),
            models.Index(fields=["visitor", "visited_at"]),
        ]

    def __str__(self) -> str:
        return f"Visit {self.pk} → {self.visitor_id} ({self.visiting})"
