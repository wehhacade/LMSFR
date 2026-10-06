from django.db import models


class AgentStatus(models.Model):
    """Configurable agent operational status (ACTIVE, INJURED, etc.)."""

    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    name_so = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    is_active_state = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_system = models.BooleanField(default=True)

    class Meta:
        db_table = "personnel_agent_statuses"
        ordering = ["sort_order", "name"]
        verbose_name_plural = "agent statuses"

    def __str__(self) -> str:
        return self.name


class AttendanceStatus(models.Model):
    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    name_so = models.CharField(max_length=120, blank=True)
    requires_reason = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "personnel_attendance_statuses"
        ordering = ["sort_order", "name"]
        verbose_name_plural = "attendance statuses"

    def __str__(self) -> str:
        return self.name


class AbsenceReason(models.Model):
    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    name_so = models.CharField(max_length=120, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "personnel_absence_reasons"
        ordering = ["sort_order", "name"]
        verbose_name_plural = "absence reasons"

    def __str__(self) -> str:
        return self.name
