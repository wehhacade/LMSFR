from django.conf import settings
from django.db import models


class AgentRestriction(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        RELEASED = "released", "Released"
        EXTENDED = "extended", "Extended"

    class ItemStatus(models.TextChoices):
        HELD = "held", "Withheld"
        RETURNED = "returned", "Returned"
        NOT_APPLICABLE = "na", "N/A"

    agent = models.ForeignKey(
        "accounts.Agent",
        on_delete=models.CASCADE,
        related_name="restrictions",
    )
    reason = models.CharField(max_length=500)
    start_date = models.DateField()
    end_date = models.DateField()
    id_card_status = models.CharField(
        max_length=20,
        choices=ItemStatus.choices,
        default=ItemStatus.HELD,
    )
    weapon_status = models.CharField(
        max_length=20,
        choices=ItemStatus.choices,
        default=ItemStatus.HELD,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="restrictions_created",
    )
    released_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="restrictions_released",
    )
    released_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "personnel_restrictions"
        ordering = ["-start_date", "-created_at"]
        indexes = [
            models.Index(fields=["agent", "status"]),
            models.Index(fields=["end_date", "status"]),
        ]
        permissions = [
            ("restriction_view", "Can view agent restrictions"),
            ("restriction_create", "Can create agent restrictions"),
            ("restriction_update", "Can update agent restrictions"),
            ("restriction_release", "Can release agent restrictions"),
        ]

    def __str__(self) -> str:
        return f"Restriction {self.agent_id} ({self.status})"


class AgentRestrictionAction(models.Model):
    class ActionType(models.TextChoices):
        EXTEND = "extend", "Extend"
        RELEASE = "release", "Release"

    restriction = models.ForeignKey(
        AgentRestriction,
        on_delete=models.CASCADE,
        related_name="actions",
    )
    action = models.CharField(max_length=20, choices=ActionType.choices)
    new_end_date = models.DateField(null=True, blank=True)
    new_reason = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="restriction_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "personnel_restriction_actions"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.action} on restriction {self.restriction_id}"
