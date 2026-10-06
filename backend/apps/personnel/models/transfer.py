from django.conf import settings
from django.db import models


class AgentAssignmentHistory(models.Model):
    """Immutable transfer / district assignment history."""

    agent = models.ForeignKey(
        "accounts.Agent",
        on_delete=models.CASCADE,
        related_name="assignment_history",
    )
    from_county = models.ForeignKey(
        "accounts.County",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignment_transfers_from",
    )
    to_county = models.ForeignKey(
        "accounts.County",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignment_transfers_to",
    )
    from_department = models.ForeignKey(
        "accounts.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignment_transfers_from",
    )
    to_department = models.ForeignKey(
        "accounts.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignment_transfers_to",
    )
    reason = models.CharField(max_length=500, blank=True)
    transfer_date = models.DateField()
    notes = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_transfers_performed",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "personnel_assignment_history"
        ordering = ["-transfer_date", "-created_at"]
        indexes = [
            models.Index(fields=["agent", "-transfer_date"]),
            models.Index(fields=["to_county", "-transfer_date"]),
        ]
        permissions = [
            ("agent_transfer", "Can transfer agents between districts"),
        ]

    def __str__(self) -> str:
        return f"{self.agent_id}: {self.from_county_id} → {self.to_county_id}"


class AgentStatusHistory(models.Model):
    agent = models.ForeignKey(
        "accounts.Agent",
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    old_status = models.ForeignKey(
        "personnel.AgentStatus",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history_as_old",
    )
    new_status = models.ForeignKey(
        "personnel.AgentStatus",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history_as_new",
    )
    reason = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_status_changes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "personnel_status_history"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["agent", "-created_at"]),
        ]
        permissions = [
            ("agent_status_manage", "Can manage agent operational status"),
        ]

    def __str__(self) -> str:
        return f"{self.agent_id}: status change at {self.created_at}"
