from django.conf import settings
from django.db import models

from apps.accounts.models import County
from apps.hubkadhigis.utils.validators import file_extension_validator

from .lookups import ForceUnit, Rank, SurrenderLocation, WeaponType


class DisarmamentRecord(models.Model):
    """Hubkadhigis — weapon surrender / disarmament record."""

    reference_number = models.CharField(max_length=100, blank=True, db_index=True)
    person_name = models.CharField(max_length=500, blank=True, db_index=True)
    police_station = models.CharField(max_length=500, blank=True)
    phone_number = models.CharField(max_length=50, blank=True)
    force_unit = models.ForeignKey(ForceUnit, on_delete=models.SET_NULL, null=True, blank=True)
    force_number = models.CharField(max_length=500, blank=True)
    details = models.TextField(blank=True)
    rank = models.ForeignKey(Rank, on_delete=models.SET_NULL, null=True, blank=True)
    weapon_type = models.ForeignKey(WeaponType, on_delete=models.SET_NULL, null=True, blank=True)
    weapon_serial = models.CharField(max_length=500, blank=True, db_index=True)
    county = models.ForeignKey(County, on_delete=models.SET_NULL, null=True, blank=True)
    surrender_location = models.ForeignKey(SurrenderLocation, on_delete=models.SET_NULL, null=True, blank=True)
    surrender_date = models.DateTimeField(null=True, blank=True)
    cover_image = models.FileField(
        upload_to="uploads/disarmament/weapon/",
        blank=True,
        null=True,
        validators=[file_extension_validator],
    )
    person_image = models.FileField(
        upload_to="uploads/disarmament/person/",
        blank=True,
        null=True,
        validators=[file_extension_validator],
    )
    latitude = models.CharField(max_length=50, default="0", blank=True)
    longitude = models.CharField(max_length=50, default="0", blank=True)
    year = models.CharField(max_length=20, blank=True)
    month = models.CharField(max_length=20, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="disarmament_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "disarmament_records"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["reference_number", "created_at"])]

    def __str__(self) -> str:
        return self.person_name or self.reference_number or str(self.pk)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.reference_number:
            from apps.hubkadhigis.services.records import assign_reference_number

            assign_reference_number(self)


class DisarmamentImage(models.Model):
    IMAGE_WEAPON = "weapon"
    IMAGE_EVIDENCE = "evidence"
    IMAGE_TYPE_CHOICES = (
        (IMAGE_WEAPON, "Weapon"),
        (IMAGE_EVIDENCE, "Evidence"),
    )

    record = models.ForeignKey(DisarmamentRecord, on_delete=models.CASCADE, related_name="images")
    file = models.FileField(upload_to="uploads/disarmament/images/", validators=[file_extension_validator])
    image_type = models.CharField(
        max_length=20,
        choices=IMAGE_TYPE_CHOICES,
        default=IMAGE_EVIDENCE,
        db_index=True,
    )
    caption = models.CharField(max_length=255, blank=True)
    weapon_type = models.ForeignKey(WeaponType, on_delete=models.SET_NULL, null=True, blank=True)
    weapon_serial = models.CharField(max_length=255, blank=True)
    county = models.ForeignKey(County, on_delete=models.SET_NULL, null=True, blank=True)
    surrender_location = models.ForeignKey(SurrenderLocation, on_delete=models.SET_NULL, null=True, blank=True)
    surrender_date = models.DateField(null=True, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "disarmament_images"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.caption or f"Image {self.pk}"
