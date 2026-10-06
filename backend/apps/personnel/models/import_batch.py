from django.conf import settings
from django.db import models


class AgentImportBatch(models.Model):
    class Status(models.TextChoices):
        UPLOADED = "uploaded", "Uploaded"
        VALIDATED = "validated", "Validated"
        PREVIEWED = "previewed", "Previewed"
        APPLIED = "applied", "Applied"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    filename = models.CharField(max_length=500)
    source_section = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPLOADED)
    summary = models.JSONField(default=dict, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_import_batches",
    )
    applied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "personnel_import_batches"
        ordering = ["-created_at"]
        permissions = [
            ("agent_import", "Can upload agent import files"),
            ("agent_import_review", "Can review agent import previews"),
            ("agent_import_apply", "Can apply agent import changes"),
        ]

    def __str__(self) -> str:
        return f"Import {self.pk}: {self.filename}"


class AgentImportRow(models.Model):
    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        TRANSFER = "transfer", "Transfer"
        REMOVE_FROM_SECTION = "remove_from_section", "Remove from section"
        SKIP = "skip", "Skip"
        ERROR = "error", "Error"
        CONFLICT = "conflict", "Conflict"

    batch = models.ForeignKey(
        AgentImportBatch,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_number = models.PositiveIntegerField()
    service_id = models.CharField(max_length=50, blank=True, db_index=True)
    agent_name = models.CharField(max_length=300, blank=True)
    action = models.CharField(max_length=20, choices=Action.choices, default=Action.SKIP)
    validation_errors = models.JSONField(default=list, blank=True)
    diff = models.JSONField(default=dict, blank=True)
    raw_data = models.JSONField(default=dict, blank=True)
    agent = models.ForeignKey(
        "accounts.Agent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_rows",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "personnel_import_rows"
        ordering = ["row_number"]
        indexes = [
            models.Index(fields=["batch", "action"]),
        ]

    def __str__(self) -> str:
        return f"Row {self.row_number}: {self.service_id} ({self.action})"
