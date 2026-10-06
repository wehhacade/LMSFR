from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone

IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"]
DOCUMENT_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"]


class Survey(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        LIVE = "live", "Live"
        CLOSED = "closed", "Closed"

    name = models.CharField(max_length=200, db_index=True)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    allow_multiple_submissions = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="surveys_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def is_active(self) -> bool:
        return self.status == self.Status.LIVE


class SurveySection(models.Model):
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name="sections")
    title = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.survey.name} / {self.title or 'Section'}"


class Question(models.Model):
    class QType(models.TextChoices):
        SINGLE = "single", "Single choice"
        MULTI = "multi", "Multiple choice"
        SHORT = "short_text", "Short text"
        LONG = "long_text", "Long text"
        INT = "integer", "Integer"
        DEC = "decimal", "Decimal"
        DATE = "date", "Date"
        RATING = "rating", "Rating"
        BOOL = "boolean", "Boolean"

    section = models.ForeignKey(SurveySection, on_delete=models.CASCADE, related_name="questions")
    text = models.CharField(max_length=500)
    help_text = models.CharField(max_length=300, blank=True)
    qtype = models.CharField(max_length=20, choices=QType.choices)
    required = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    min_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return self.text


class Choice(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="choices")
    label = models.CharField(max_length=300)
    value = models.CharField(max_length=100)
    order = models.PositiveIntegerField(default=0)
    # When selected, respondents must fill Answer.value_text (e.g. "Wax kale").
    is_other = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.question.text[:40]} - {self.label}"


class Response(models.Model):
    """Hal survey submission — jawaabaha + xogta goobta / guriga."""

    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name="responses")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="survey_responses",
    )
    county = models.ForeignKey(
        "accounts.County",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="survey_responses",
    )
    sub_county = models.ForeignKey(
        "accounts.SubCounty",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="survey_responses",
    )
    guri_number = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=30, blank=True)
    deadline_duration = models.DurationField(null=True, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    identity_file = models.FileField(
        upload_to="uploads/surveys/identity/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=DOCUMENT_EXTENSIONS)],
    )
    photo = models.FileField(
        upload_to="uploads/surveys/photo/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=IMAGE_EXTENSIONS)],
    )
    sawirka_guriga = models.FileField(
        upload_to="uploads/surveys/house_photo/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=IMAGE_EXTENSIONS)],
    )
    documentiga_guriga = models.FileField(
        upload_to="uploads/surveys/house_document/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=DOCUMENT_EXTENSIONS)],
    )
    context_object = models.CharField(max_length=100, blank=True)
    context_id = models.CharField(max_length=64, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["survey", "user", "context_object", "context_id"]),
            models.Index(fields=["survey", "-submitted_at"]),
            models.Index(fields=["survey", "phone_number"]),
        ]

    def __str__(self) -> str:
        return f"{self.survey.name} / {self.user_id or 'anon'} @ {self.submitted_at:%Y-%m-%d %H:%M}"

    @property
    def navigation_url(self) -> str:
        if self.latitude is None or self.longitude is None:
            return ""
        return f"https://www.google.com/maps?q={self.latitude},{self.longitude}"

    @property
    def deadline_at(self):
        if not self.deadline_duration:
            return None
        return self.submitted_at + self.deadline_duration

    @property
    def is_deadline_expired(self) -> bool:
        deadline = self.deadline_at
        if not deadline:
            return False
        return timezone.now() >= deadline


class Answer(models.Model):
    response = models.ForeignKey(Response, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="answers")
    value_text = models.TextField(blank=True)
    value_number = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    value_bool = models.BooleanField(null=True, blank=True)
    value_date = models.DateField(null=True, blank=True)
    choices = models.ManyToManyField(Choice, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["response", "question"], name="uniq_answer_per_question"),
        ]

    def __str__(self) -> str:
        return f"{self.response_id} -> {self.question_id}"
