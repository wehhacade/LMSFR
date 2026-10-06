from django.conf import settings
from django.db import models


class AgentAccess(models.Model):
    """Galaangal / additional access enrollment."""

    agent = models.ForeignKey("accounts.Agent", on_delete=models.CASCADE, related_name="access_records")
    reference_number = models.CharField(max_length=100, blank=True, default="")
    access_location = models.CharField(max_length=100, blank=True, default="")
    relationship_type = models.CharField(max_length=100, blank=True, default="")
    joined_at = models.CharField(max_length=100, blank=True, default="")
    training = models.CharField(max_length=20, blank=True, default="")
    training_location = models.CharField(max_length=100, blank=True, default="")
    role_held = models.CharField(max_length=100, blank=True, default="")
    occupation = models.CharField(max_length=100, blank=True, default="")
    referrer_name = models.CharField(max_length=100, blank=True, default="")
    referrer_phone = models.CharField(max_length=100, blank=True, default="")
    referrer_email = models.CharField(max_length=100, blank=True, default="")
    referrer_role = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_access_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agent_access"
        ordering = ["-created_at"]


class AgentRelative(models.Model):
    agent = models.ForeignKey("accounts.Agent", on_delete=models.CASCADE, related_name="relatives")
    full_name = models.CharField(max_length=100)
    relationship = models.CharField(max_length=80)
    district = models.CharField(max_length=80)
    phone = models.CharField(max_length=20)
    description = models.TextField(blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_relatives_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agent_relatives"
        ordering = ["-created_at"]


class AgentSpouse(models.Model):
    agent = models.ForeignKey("accounts.Agent", on_delete=models.CASCADE, related_name="spouses")
    marital_status = models.CharField(max_length=60)
    full_name = models.CharField(max_length=60, blank=True, default="")
    mother_name = models.CharField(max_length=60, blank=True, default="")
    phone = models.CharField(max_length=60, blank=True, default="")
    marriage_date = models.CharField(max_length=60, blank=True, default="")
    marriage_place = models.CharField(max_length=60, blank=True, default="")
    tribe = models.CharField(max_length=100, blank=True, default="")
    photo = models.FileField(upload_to="agents/spouses/", blank=True, null=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_spouses_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agent_spouses"
        ordering = ["-created_at"]


class AgentChild(models.Model):
    agent = models.ForeignKey("accounts.Agent", on_delete=models.CASCADE, related_name="children")
    first_name = models.CharField(max_length=50)
    father_name = models.CharField(max_length=100)
    date_of_birth = models.CharField(max_length=100)
    place_of_birth = models.CharField(max_length=100)
    phone = models.CharField(max_length=100, blank=True, default="")
    gender = models.CharField(max_length=20)
    mother_name = models.CharField(max_length=100)
    photo = models.FileField(upload_to="agents/children/", blank=True, null=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_children_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agent_children"
        ordering = ["-created_at"]


class AgentFile(models.Model):
    agent = models.ForeignKey("accounts.Agent", on_delete=models.CASCADE, related_name="files")
    file_name = models.CharField(max_length=100)
    file = models.FileField(upload_to="agents/files/")
    file_code = models.CharField(max_length=50, blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_files_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agent_files"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.file_code:
            from django.utils import timezone

            stamp = timezone.now().strftime("%m%y%d")
            count = AgentFile.objects.filter(file_code__startswith=f"GLKA{stamp}").count() + 1
            self.file_code = f"GLKA{stamp}{count:04d}"
        super().save(*args, **kwargs)
