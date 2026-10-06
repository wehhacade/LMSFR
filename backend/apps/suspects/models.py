from django.conf import settings
from django.db import models

from apps.accounts.models import County, Country, SubCounty


MOGADISHU_DISTRICTS = [
    "Hodan", "Hawlwadaag", "Heliwa", "Warta Nabadda", "Bondhere",
    "Dayniile", "Dharkanleey", "Kaaraan", "Wadajir", "Waberi",
    "Shibis", "Shangani", "Yaqshid", "Bakaaro", "Huriwaa",
    "Abdalla Shideeye",
]

DEFAULT_SUSPECT_STATUSES = (
    "Shaki",
    "Argagixi",
    "Dambiile",
    "La socda",
    "Khalad",
)


def visible_bail_count(value) -> int:
    """Hide the initial case; repeat badges begin at the second case."""
    count = max(0, int(value or 0))
    return count if count > 1 else 0


def capture_count_for_suspect(suspect_id: int) -> int:
    """
    How many times a suspect was booked.

    A damiin attached to an existing booking must not read as a new capture, so
    cases carrying a damiin are the source of truth; a suspect whose only case is
    still waiting for a damiin counts as one capture.
    """
    cases = SuspectCase.objects.filter(suspect_id=suspect_id)
    with_damiin = cases.filter(damiin__isnull=False).count()
    return with_damiin or cases.count()


class SuspectStatus(models.Model):
    """Tuhunka — e.g. Shaki, Argagixi (old SuspectStatus table)."""

    name = models.CharField(max_length=120, unique=True)

    class Meta:
        db_table = "suspectstatus"
        ordering = ["name"]
        verbose_name_plural = "suspect statuses"

    def __str__(self) -> str:
        return self.name


class Suspect(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        WATCHING = "watching", "Watching"
        CLEARED = "cleared", "Cleared"
        DETAINED = "detained", "Detained"

    class Risk(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

    class Source(models.TextChoices):
        AMNIGA = "amniga", "Amniga"
        BAARIS = "baaris", "Baaris"

    name = models.CharField(max_length=200, db_index=True)
    alias = models.CharField(max_length=120, blank=True)
    mother_name = models.CharField(max_length=100, blank=True, db_index=True)
    photo_url = models.URLField(max_length=500, blank=True)
    district = models.CharField(max_length=120, db_index=True)
    case_ref = models.CharField(max_length=64, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    risk = models.CharField(max_length=20, choices=Risk.choices, default=Risk.MEDIUM, db_index=True)
    suspect_type = models.ForeignKey(
        SuspectStatus,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="suspects",
    )
    date_of_birth = models.DateField(null=True, blank=True)
    goobta_dhalashada = models.CharField(max_length=100, blank=True)
    address = models.ForeignKey(
        County,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="address_suspects",
    )
    phone = models.CharField(max_length=20, blank=True, db_index=True)
    marriage_status = models.CharField(max_length=100, blank=True)
    children = models.PositiveSmallIntegerField(default=0)
    xabsi_waligaa_ma_soo_martay = models.CharField(max_length=50, blank=True)
    tribe = models.CharField(max_length=100, blank=True)
    occupation = models.CharField(max_length=100, blank=True)
    lambarka_diiwaanka = models.CharField(max_length=100, blank=True)
    is_released = models.BooleanField(default=False)
    bail_count = models.PositiveIntegerField(default=0)
    father_contact = models.CharField(max_length=50, blank=True)
    mother_contact = models.CharField(max_length=50, blank=True)
    date_opp = models.DateField(null=True, blank=True)
    day = models.CharField(max_length=10, blank=True)
    month = models.CharField(max_length=10, blank=True)
    year = models.CharField(max_length=10, blank=True)
    latitude = models.CharField(max_length=20, blank=True)
    longitude = models.CharField(max_length=20, blank=True)
    nationality = models.ForeignKey(
        Country,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="suspects",
    )
    gender = models.CharField(max_length=50, blank=True)
    goobta_shaqada = models.CharField(max_length=100, blank=True)
    suspect_identifier = models.CharField(max_length=300, blank=True)
    capture_county = models.ForeignKey(
        County,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="captured_suspects",
    )
    capture_sub_county = models.ForeignKey(
        SubCounty,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="captured_suspects",
    )
    last_seen = models.DateField()
    offense = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registered_suspects",
    )
    # Registry partition: amniga (existing criminal/suspect flow) vs baaris (citizen ID).
    # Default amniga keeps all legacy rows and amniga APIs behavior-identical.
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.AMNIGA,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "suspects"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["-updated_at"]),
            models.Index(fields=["status", "risk"]),
            models.Index(fields=["source", "-updated_at"]),
        ]
        permissions = [
            ("view_daily_report", "Can view daily report of suspects"),
            ("view_special_case", "Can view suspect history"),
        ]

    def __str__(self) -> str:
        return self.name


class Damiinada(models.Model):
    """Standalone guarantor — linked to suspects only through SuspectCase."""

    code = models.CharField(max_length=20, unique=True, blank=True, db_index=True)
    name = models.CharField(max_length=200, db_index=True)
    gender = models.CharField(max_length=50, blank=True)
    phone = models.CharField(max_length=30, blank=True, db_index=True)
    new_relationship = models.ForeignKey(
        "accounts.Relationship",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="damiinada",
    )
    relationship = models.CharField(max_length=80, blank=True)
    county = models.ForeignKey(
        County,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="damiinada",
    )
    sub_county = models.ForeignKey(
        SubCounty,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="damiinada",
    )
    occupation = models.CharField(max_length=200, blank=True)
    workplace = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    picture_url = models.URLField(max_length=500, blank=True)
    identity_picture_url = models.URLField(max_length=500, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registered_damiinada",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "damiinada"
        ordering = ["-created_at"]
        verbose_name_plural = "damiinada"

    def __str__(self) -> str:
        return self.name


# Backward-compatible alias used in a few imports during transition.
SuspectGuarantor = Damiinada


class SuspectCase(models.Model):
    """Case row — suspect + damiin + tuhunka + capture location + faahfaahin."""

    case_code = models.CharField(max_length=20, unique=True, blank=True, db_index=True)
    suspect = models.ForeignKey(Suspect, on_delete=models.CASCADE, related_name="cases")
    damiin = models.ForeignKey(
        Damiinada,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cases",
    )
    tuhunka = models.ForeignKey(
        SuspectStatus,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cases",
    )
    capture_county = models.ForeignKey(
        County,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="suspect_cases",
    )
    capture_sub_county = models.ForeignKey(
        SubCounty,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="suspect_cases",
    )
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registered_cases",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "suspectcase"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["suspect", "-created_at"]),
            models.Index(fields=["damiin", "-created_at"]),
        ]

    def __str__(self) -> str:
        return self.case_code or f"Case #{self.pk}"


class SuspectArrest(models.Model):
    suspect = models.ForeignKey(Suspect, on_delete=models.CASCADE, related_name="arrests")
    officer_name = models.CharField(max_length=200)
    officer_badge = models.CharField(max_length=64, blank=True)
    unit = models.CharField(max_length=120, blank=True)
    arrested_at = models.DateTimeField()
    location = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "suspectarrest"
        ordering = ["-arrested_at"]

    def __str__(self) -> str:
        return f"{self.officer_name} — {self.arrested_at:%Y-%m-%d}"


class SuspectComment(models.Model):
    suspect = models.ForeignKey(Suspect, on_delete=models.CASCADE, related_name="comments")
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )
    author_name = models.CharField(max_length=120)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "suspectcomment"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.author_name}: {self.body[:40]}"


class SuspectResponse(models.Model):
    """Agent response thread root — old suspectresponse table."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="suspect_responses",
    )
    suspect = models.ForeignKey(Suspect, on_delete=models.CASCADE, related_name="responses")
    details = models.TextField()
    date_opp = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "suspectresponse"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["suspect", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Response #{self.pk} — {self.suspect_id}"

    def comment_count(self) -> int:
        return self.comments.count()


class SuspectFaceEmbedding(models.Model):
    """On-device face vector — photo never stored here, only normalized embedding."""

    suspect = models.OneToOneField(
        Suspect,
        on_delete=models.CASCADE,
        related_name="face_embedding",
    )
    vector = models.JSONField(default=list)
    vectors = models.JSONField(default=list, blank=True)
    vector_hash = models.CharField(max_length=64, db_index=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "suspectfaceembedding"
        indexes = [
            models.Index(fields=["vector_hash"]),
        ]

    def __str__(self) -> str:
        return f"FaceEmbedding suspect={self.suspect_id}"


class ResponseComment(models.Model):
    """Comment on a suspect response — old responsecomments table."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="response_comments",
    )
    response = models.ForeignKey(SuspectResponse, on_delete=models.CASCADE, related_name="comments")
    comment = models.TextField(blank=True)
    images = models.ImageField(upload_to="SuspectResponseImg/", blank=True, null=True)
    audio = models.FileField(upload_to="ResponseAudio/", blank=True, null=True)
    date_opp = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "responsecomments"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["response", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Comment #{self.pk}"

    def reply_count(self) -> int:
        return self.replies.count()


class CommentReply(models.Model):
    """Reply to a response comment — old commentsreply table."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comment_replies",
    )
    comment = models.ForeignKey(ResponseComment, on_delete=models.CASCADE, related_name="replies")
    commentsReply = models.TextField()
    date_opp = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "commentsreply"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["comment", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Reply #{self.pk}"


class FCMToken(models.Model):
    class AppSlug(models.TextChoices):
        ILAALO = "ilaalo", "Ilaalo Shacab"
        SURVEY = "survey", "Survey mobile"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="fcm_tokens",
    )
    fcm_token = models.CharField(max_length=255, unique=True, db_index=True)
    app_slug = models.CharField(
        max_length=20,
        choices=AppSlug.choices,
        default=AppSlug.ILAALO,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fcmtoken"
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["app_slug", "user"]),
        ]

    def __str__(self) -> str:
        return f"FCM {self.fcm_token[:12]}…"


class Notice(models.Model):
    tobic = models.CharField(max_length=100)
    body = models.TextField()
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notices",
    )
    is_new = models.BooleanField(default=False)
    date_opp = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notices"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["is_new"]),
        ]

    def __str__(self) -> str:
        return self.tobic
