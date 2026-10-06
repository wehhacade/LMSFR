from django.contrib.auth.models import AbstractUser
from django.db import models


class UserType(models.Model):
    name = models.CharField(max_length=50, unique=True)
    code = models.CharField(max_length=10, blank=True)

    class Meta:
        db_table = "user_types"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Directorate(models.Model):
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "directorates"

    def __str__(self) -> str:
        return self.name


class Department(models.Model):
    """Legacy Qaybta / walkie qeyb (dynamic county group)."""

    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    counties = models.ManyToManyField(
        "County",
        blank=True,
        related_name="departments",
    )

    class Meta:
        db_table = "departments"

    def __str__(self) -> str:
        return self.name


class Region(models.Model):
    """Gobol — old Settings.Regions / region table (integer id = legacy MySQL id)."""

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=10, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "regions"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class County(models.Model):
    region = models.ForeignKey(
        Region,
        on_delete=models.CASCADE,
        related_name="counties",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=10, blank=True)
    description = models.CharField(max_length=200, blank=True)
    image = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "counties"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["region", "name"], name="uniq_county_per_region"),
        ]

    def __str__(self) -> str:
        return self.name


class SubCounty(models.Model):
    """Waaxda / sub-district — integer id = legacy MySQL id."""

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=100, blank=True)
    description = models.CharField(max_length=100, blank=True)
    county = models.ForeignKey(County, on_delete=models.CASCADE, related_name="sub_counties")

    class Meta:
        db_table = "sub_counties"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Relationship(models.Model):
    """Xiriirka — old Settings.Relationships / relationship table."""

    relationship = models.CharField(max_length=50, unique=True)

    class Meta:
        db_table = "relationship"
        ordering = ["id"]
        verbose_name_plural = "relationships"

    def __str__(self) -> str:
        return self.relationship


Relationships = Relationship


class Country(models.Model):
    name = models.CharField(max_length=120, unique=True)

    class Meta:
        db_table = "countries"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class IdentityType(models.Model):
    name = models.CharField(max_length=120, unique=True)

    class Meta:
        db_table = "identity_types"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Section(models.Model):
    """Laamaha / people_section — old Settings.Sections."""

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=100, blank=True)
    sub_county = models.ForeignKey(SubCounty, on_delete=models.CASCADE, related_name="sections")

    class Meta:
        db_table = "people_sections"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class User(AbstractUser):
    """Legacy-compatible users table — integer PK (same as old LMSBR MySQL)."""

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=50, blank=True, default="")
    gender = models.CharField(max_length=10, blank=True, null=True)
    user_type = models.ForeignKey(UserType, on_delete=models.SET_NULL, null=True, blank=True)
    is_admin = models.BooleanField(default=False)
    is_officer = models.BooleanField(default=False)
    is_agent = models.BooleanField(default=False)
    password_changed = models.BooleanField(default=False)
    app_pin = models.CharField(max_length=255, blank=True, null=True)
    app_pin_changed = models.BooleanField(default=False)
    suspend = models.BooleanField(default=False)
    sirdoon = models.BooleanField(default=False)
    amni_sir = models.CharField(max_length=300, blank=True, null=True)
    latitude = models.CharField(max_length=50, blank=True, null=True)
    longitude = models.CharField(max_length=50, blank=True, null=True)
    location = models.CharField(max_length=50, blank=True, null=True)
    mobile_type = models.CharField(max_length=50, default="Samsung", blank=True)
    bio = models.TextField(blank=True, null=True)
    profile = models.FileField(upload_to="avatars/", blank=True, null=True)
    last_login_device = models.TextField(blank=True, null=True)
    login_attempts = models.IntegerField(default=0)
    lock_until = models.DateTimeField(null=True, blank=True)
    directorate = models.ForeignKey(Directorate, on_delete=models.RESTRICT, null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.RESTRICT, null=True, blank=True)
    county = models.ForeignKey(County, on_delete=models.SET_NULL, null=True, blank=True)
    type_of_user = models.CharField(max_length=50, blank=True, null=True)
    is_mobile = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "users"
        ordering = ["-date_joined"]
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["is_active", "suspend"]),
            models.Index(fields=["-date_joined"]),
        ]

    def __str__(self) -> str:
        return self.email

    @property
    def role(self) -> str:
        if self.is_superuser or self.is_admin:
            return "admin"
        if self.is_officer:
            return "officer"
        if self.is_agent:
            return "agent"
        return "user"


class Agent(models.Model):
    PRESENT_CHOICES = [
        ("Joogey", "Present"),
        ("Maqan", "Absent"),
        ("Xanuunsan", "Sick"),
        ("Staff", "Staff"),
        ("Fakad", "Fakad"),
        ("Fasax", "Leave"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="agent_profile", null=True, blank=True)
    service_id = models.CharField(max_length=50, unique=True, blank=True, null=True)
    first_name = models.CharField(max_length=50)
    father_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    fourth_name = models.CharField(max_length=50)
    mother_name = models.CharField(max_length=50)
    nickname = models.CharField(max_length=50, blank=True, null=True)
    date_of_birth = models.CharField(max_length=50)
    gender = models.CharField(max_length=50, blank=True, null=True)
    phone = models.CharField(max_length=15, unique=True)
    email = models.EmailField(blank=True, null=True)
    personal_fullname = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, default="Active")
    present = models.CharField(max_length=100, default="Joogey", choices=PRESENT_CHOICES)
    profile = models.FileField(upload_to="uploads/agents/", blank=True, null=True)
    biography = models.TextField(blank=True, null=True)
    weapon_name = models.CharField(max_length=200, blank=True, null=True)
    serial_number = models.CharField(max_length=200, blank=True, null=True)
    tribe_name = models.CharField(max_length=200, blank=True, null=True)
    region_name = models.CharField(max_length=200, blank=True, null=True)
    county = models.ForeignKey(County, on_delete=models.SET_NULL, null=True, blank=True)
    sub_county_name = models.CharField(max_length=200, blank=True, null=True)
    section_name = models.CharField(max_length=200, blank=True, null=True)
    directorate = models.ForeignKey(Directorate, on_delete=models.RESTRICT, null=True, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="agents_recorded")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agents"

    @property
    def personal_number(self) -> str:
        if self.service_id:
            return self.service_id
        if self.user_id:
            return self.user.username or ""
        return ""

    def save(self, *args, **kwargs):
        self.personal_fullname = f"{self.first_name} {self.father_name} {self.last_name} {self.fourth_name}".strip()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.personal_fullname or self.first_name


class OTPCode(models.Model):
    number = models.CharField(max_length=6)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="otp_code")

    class Meta:
        db_table = "otp_codes"


class UserDevice(models.Model):
    device = models.CharField(max_length=100, blank=True, null=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="devices")
    action = models.TextField(blank=True, null=True)
    ip_address = models.TextField(blank=True, null=True)
    operating_system = models.TextField(blank=True, null=True)
    browser = models.TextField(blank=True, null=True)
    network = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_devices"
