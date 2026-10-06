"""Legacy mobile tables — same names as old LMSBR MySQL where possible."""

from django.conf import settings
from django.db import models

from apps.accounts.models import Country
from apps.suspects.models import Suspect


class UserLocation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="location_history",
    )
    suspect = models.ForeignKey(
        Suspect,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="location_history",
    )
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)
    reg_day = models.CharField(max_length=10, blank=True)
    year = models.CharField(max_length=10, blank=True)
    month = models.CharField(max_length=10, blank=True)

    class Meta:
        db_table = "user_location"
        indexes = [
            models.Index(fields=["user", "-last_updated"], name="uloc_user_updated_idx"),
        ]


class UserSuspectTag(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    suspect = models.ForeignKey(Suspect, on_delete=models.CASCADE)
    tag = models.CharField(max_length=10, default="new")
    click_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "usersuspecttag"
        unique_together = ("user", "suspect")
        indexes = [
            models.Index(fields=["user", "suspect"], name="ustag_user_suspect_idx"),
        ]


class SuspectCarModal(models.Model):
    name = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "suspectcarmodal"
        ordering = ["name"]


class SuspectCar(models.Model):
    class Source(models.TextChoices):
        AMNIGA = "amniga", "Amniga"
        BAARIS = "baaris", "Baaris"

    car_model = models.ForeignKey(
        SuspectCarModal,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cars",
    )
    plate_number = models.CharField(max_length=50, blank=True)
    old_car_model = models.CharField(max_length=50, blank=True)
    suspect = models.ForeignKey(Suspect, on_delete=models.SET_NULL, null=True, blank=True)
    # Mirrors suspect.source so car lists can filter without joining when needed.
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.AMNIGA,
        db_index=True,
    )
    latitude = models.CharField(max_length=20, blank=True)
    longitude = models.CharField(max_length=20, blank=True)
    description = models.TextField(blank=True)
    ownership = models.CharField(max_length=20, blank=True)
    ownername = models.CharField(max_length=100, blank=True)
    ownerphone = models.CharField(max_length=30, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_cars",
    )
    picture = models.FileField(upload_to="car_pictures/", blank=True, null=True)
    date_opp = models.DateField(null=True, blank=True)
    day = models.CharField(max_length=10, blank=True)
    month = models.CharField(max_length=10, blank=True)
    year = models.CharField(max_length=10, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cars"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"], name="cars_created_desc_idx"),
            models.Index(fields=["plate_number"], name="cars_plate_idx"),
            models.Index(fields=["source", "-created_at"], name="cars_source_created_idx"),
        ]


class MobileTask(models.Model):
    """Daily reports — old Tasks.Task table."""

    name = models.CharField(max_length=255)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mobile_reports",
    )
    description = models.TextField()
    is_seen = models.BooleanField(default=False)
    picture = models.ImageField(upload_to="warbixinada_images/", blank=True, null=True)
    date_opp = models.DateField(null=True, blank=True)
    day = models.CharField(max_length=10, blank=True)
    month = models.CharField(max_length=10, blank=True)
    year = models.CharField(max_length=10, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "task"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"], name="task_created_desc_idx"),
            models.Index(fields=["user", "-created_at"], name="task_user_created_idx"),
        ]


class CabashadaAppka(models.Model):
    type = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cabasho_entries",
    )
    is_seen = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cabashadaappka"
        ordering = ["-created_at"]


class AppDocument(models.Model):
    tobic = models.CharField(max_length=100, blank=True)
    body = models.TextField()
    tag = models.CharField(max_length=50, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "appdocument"
        ordering = ["id"]


class WantedType(models.Model):
    name = models.CharField(max_length=100)

    class Meta:
        db_table = "wantedtype"
        ordering = ["name"]


class WantedPerson(models.Model):
    full_name = models.CharField(max_length=200, db_index=True)
    gender = models.CharField(max_length=20, blank=True)
    phone = models.CharField(max_length=20, blank=True, db_index=True)
    mother_name = models.CharField(max_length=100, blank=True)
    citizenship = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True)
    wanted_type = models.ForeignKey(WantedType, on_delete=models.SET_NULL, null=True, blank=True)
    wanted_status = models.CharField(max_length=50, blank=True)
    priority = models.CharField(max_length=50, blank=True)
    details = models.TextField(blank=True)
    photo = models.ImageField(upload_to="wanted_images/", blank=True, null=True)
    date_recorded = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="wanted_persons_created",
    )

    class Meta:
        db_table = "wanted"
        ordering = ["-date_recorded"]


class AgentAppInstallation(models.Model):
    """Manual installation checklist; deliberately separate from login access."""

    class Status(models.TextChoices):
        NOT_INSTALLED = "not_installed", "Looguma shubin"
        COMPLETED = "completed", "Loogu shubay"
        IPHONE = "iphone", "iPhone"

    class NotInstalledReason(models.TextChoices):
        DID_NOT_ATTEND = "did_not_attend", "Ma imaanin"
        BASIC_PHONE = "basic_phone", "Telefoon button/Nokia wata"
        NO_PHONE = "no_phone", "Mobile ma wato"
        UNSUPPORTED_PHONE = "unsupported_phone", "Mobile-ku ma taageerayo"
        NO_INTERNET = "no_internet", "Internet/xog ma leh"
        LOGIN_ISSUE = "login_issue", "Password/login cilad"
        REFUSED = "refused", "Wuu diiday"
        OTHER = "other", "Sabab kale"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="app_installation",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NOT_INSTALLED,
        db_index=True,
    )
    # Compatibility field for existing PWA / React Native clients.
    # True means and only means the checklist status is Completed.
    installed = models.BooleanField(default=False, db_index=True)
    installed_at = models.DateTimeField(null=True, blank=True)
    not_installed_reason = models.CharField(
        max_length=30,
        choices=NotInstalledReason.choices,
        blank=True,
        default="",
        db_index=True,
    )
    not_installed_reason_detail = models.CharField(max_length=255, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agent_app_installations"
        ordering = ["user_id"]


class AppVersionPolicy(models.Model):
    """One row: which Android versionCode may still call the API.

    The dashboard edits major.minor.patch (3.0.0). The phone still sends one
    integer. 3.0.0 stays version code 3. 3.1.2 becomes 30102.
    """

    min_version_code = models.PositiveIntegerField(
        default=3,
        help_text="Lowest versionCode still allowed. Installed builds are 2 and send no header, so 3 locks them out.",
    )
    latest_version_code = models.PositiveIntegerField(
        default=3,
        help_text="The build that sends X-App-Version-Code and is allowed to call this backend.",
    )
    min_major = models.PositiveIntegerField(default=3)
    min_minor = models.PositiveSmallIntegerField(default=0)
    min_patch = models.PositiveSmallIntegerField(default=0)
    latest_major = models.PositiveIntegerField(default=3)
    latest_minor = models.PositiveSmallIntegerField(default=0)
    latest_patch = models.PositiveSmallIntegerField(default=0)
    apk_url = models.URLField(
        max_length=500,
        default="https://lmsbr.com/app/ilaalo.apk",
        help_text="Fixed download address. Replace the file here before raising the minimum.",
    )
    message = models.CharField(
        max_length=255,
        default="Cusbooneysii app-ka",
        help_text="Short text on the phone's update screen.",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "app_version_policy"
        verbose_name = "App version"
        verbose_name_plural = "App version"

    def __str__(self) -> str:
        return (
            f"min {self.min_major}.{self.min_minor}.{self.min_patch} / "
            f"latest {self.latest_major}.{self.latest_minor}.{self.latest_patch}"
        )

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
        from django.core.cache import cache

        cache.delete("mobile:app-version-policy")


class AppVersionRelease(models.Model):
    """One saved release. The live gate stays on AppVersionPolicy; this is the history."""

    version_code = models.PositiveIntegerField(db_index=True)
    version_major = models.PositiveIntegerField(default=0)
    version_minor = models.PositiveSmallIntegerField(default=0)
    version_patch = models.PositiveSmallIntegerField(default=0)
    min_version_code = models.PositiveIntegerField()
    min_major = models.PositiveIntegerField(default=0)
    min_minor = models.PositiveSmallIntegerField(default=0)
    min_patch = models.PositiveSmallIntegerField(default=0)
    apk_url = models.URLField(max_length=500)
    message = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "app_version_releases"
        ordering = ["-created_at", "-id"]
        verbose_name = "App release"
        verbose_name_plural = "App releases"

    def __str__(self) -> str:
        return f"{self.version_major}.{self.version_minor}.{self.version_patch}"
