from django.conf import settings
from django.db import models


class AgentAttendanceSession(models.Model):
    class SessionType(models.TextChoices):
        MORNING = "morning", "Morning"
        AFTERNOON = "afternoon", "Afternoon"
        EVENING = "evening", "Evening"

    county = models.ForeignKey(
        "accounts.County",
        on_delete=models.CASCADE,
        related_name="attendance_sessions",
    )
    department = models.ForeignKey(
        "accounts.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_sessions",
    )
    date = models.DateField(db_index=True)
    session = models.CharField(max_length=20, choices=SessionType.choices, default=SessionType.MORNING)
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_sessions_opened",
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "personnel_attendance_sessions"
        ordering = ["-date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["county", "date", "session"],
                name="uniq_attendance_session_per_county_date",
            ),
        ]
        permissions = [
            ("attendance_view", "Can view attendance records"),
            ("attendance_create", "Can create attendance sessions"),
            ("attendance_update", "Can update attendance records"),
        ]

    def __str__(self) -> str:
        return f"{self.county} {self.date} {self.session}"


class AgentAttendanceRecord(models.Model):
    """Immutable attendance record — never overwrite historical rows."""

    session = models.ForeignKey(
        AgentAttendanceSession,
        on_delete=models.CASCADE,
        related_name="records",
    )
    agent = models.ForeignKey(
        "accounts.Agent",
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    county = models.ForeignKey(
        "accounts.County",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records_at_time",
    )
    department = models.ForeignKey(
        "accounts.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records_at_time",
    )
    status = models.ForeignKey(
        "personnel.AttendanceStatus",
        on_delete=models.PROTECT,
        related_name="records",
    )
    absence_reason = models.ForeignKey(
        "personnel.AbsenceReason",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records_recorded",
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "personnel_attendance_records"
        ordering = ["-recorded_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "agent"],
                name="uniq_attendance_record_per_session_agent",
            ),
        ]
        indexes = [
            models.Index(fields=["agent", "-recorded_at"]),
            models.Index(fields=["county", "-recorded_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.agent_id} @ {self.session_id}: {self.status_id}"
