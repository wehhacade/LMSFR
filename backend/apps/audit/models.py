from django.conf import settings
from django.db import models


class AuditTrail(models.Model):
    class EventType(models.TextChoices):
        CLICK = "click", "Click"
        VISIT = "visit", "Page visit"
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        VIEW = "view", "View"
        LOGIN = "login", "Login"
        LOGOUT = "logout", "Logout"
        OTHER = "other", "Other"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_trails",
    )
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        default=EventType.OTHER,
        db_index=True,
    )
    action = models.TextField()
    submodule = models.CharField(max_length=120, blank=True, default="")
    module = models.CharField(max_length=80, blank=True, default="", db_index=True)
    page = models.CharField(max_length=255, blank=True, default="")
    click_target = models.CharField(max_length=255, blank=True, default="")
    entity_type = models.CharField(max_length=80, blank=True, default="", db_index=True)
    entity_id = models.CharField(max_length=64, blank=True, default="")
    details = models.JSONField(blank=True, default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    operating_system = models.CharField(max_length=120, blank=True, default="")
    browser = models.CharField(max_length=120, blank=True, default="")
    network = models.CharField(max_length=120, blank=True, default="")
    path = models.CharField(max_length=255, blank=True, default="")
    method = models.CharField(max_length=10, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_trails"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["submodule", "-created_at"]),
            models.Index(fields=["event_type", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]
        permissions = [
            ("view_audit_report", "Can view audit reports"),
            ("export_audittrail", "Can export audit trails"),
        ]

    def __str__(self) -> str:
        return f"{self.submodule}: {self.action[:60]}"


class ErrorLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="error_logs",
    )
    expected_error = models.CharField(max_length=255)
    field_error = models.TextField(blank=True, default="")
    trace_back = models.TextField(blank=True, default="")
    line_number = models.CharField(max_length=32, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True, default="")
    path = models.CharField(max_length=255, blank=True, default="")
    method = models.CharField(max_length=10, blank=True, default="")
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "error_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
        ]
        permissions = [
            ("export_errorlog", "Can export error logs"),
        ]

    def __str__(self) -> str:
        return self.expected_error


class APITrafficLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="api_traffic_logs",
    )
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=255, db_index=True)
    status_code = models.PositiveSmallIntegerField()
    duration_ms = models.PositiveIntegerField(default=0)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "api_traffic_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["path", "-created_at"]),
        ]
        permissions = [
            ("export_apitrafficlog", "Can export API traffic logs"),
        ]

    def __str__(self) -> str:
        return f"{self.method} {self.path} {self.status_code}"
