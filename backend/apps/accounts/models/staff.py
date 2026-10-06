"""Payroll Staff registry (legacy HISH `staff` table)."""

from django.conf import settings
from django.db import models


class Staff(models.Model):
    """Legacy payroll rows used by Search Staff → Create Agent."""

    employee_id = models.CharField(max_length=400, db_index=True)
    grade = models.CharField(max_length=400, blank=True, default="")
    name = models.CharField(max_length=400, blank=True, default="")
    directorate = models.CharField(max_length=400, blank=True, default="")
    position = models.CharField(max_length=400, blank=True, default="")
    bank = models.CharField(max_length=400, blank=True, default="")
    account = models.CharField(max_length=400, blank=True, default="")
    number = models.CharField(max_length=400, blank=True, default="", db_index=True)
    basic_pay = models.CharField(max_length=400, blank=True, default="")
    allowance = models.CharField(max_length=400, blank=True, default="")
    net_pay = models.CharField(max_length=400, blank=True, default="")
    hsnq = models.CharField(max_length=400, blank=True, default="")
    overall_total = models.CharField(max_length=400, blank=True, default="")
    total = models.CharField(max_length=400, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="staff_created",
    )

    class Meta:
        db_table = "staff"
        verbose_name = "Staff"
        verbose_name_plural = "Staff"

    def __str__(self) -> str:
        return self.name or self.employee_id or str(self.pk)
