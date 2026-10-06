from django.db import models


MOGADISHU_DISTRICTS = [
    "Hodan", "Hawlwadaag", "Heliwa", "Warta Nabadda", "Bondhere",
    "Dayniile", "Dharkanleey", "Kaaraan", "Wadajir", "Waberi",
    "Shibis", "Shangani", "Yaqshid", "Bakaaro", "Huriwaa",
    "Abdalla Shideeye",
]


class Force(models.Model):
    class Rank(models.TextChoices):
        PRIVATE    = "private",    "Askari"
        CORPORAL   = "corporal",   "Koorborol"
        SERGEANT   = "sergeant",   "Sarjaan"
        LIEUTENANT = "lieutenant", "Lieftenant"
        CAPTAIN    = "captain",    "Kaabtaan"
        MAJOR      = "major",      "Meejor"

    class Status(models.TextChoices):
        ON_DUTY   = "on_duty",   "Shaqaynaya"
        ON_LEAVE  = "on_leave",  "Fasax"
        MEDICAL   = "medical",   "Caafimaad"
        SUSPENDED = "suspended", "La joojiyay"

    name         = models.CharField(max_length=200, db_index=True)
    badge_number = models.CharField(max_length=64, unique=True, db_index=True)
    photo_url    = models.URLField(max_length=500, blank=True)
    rank         = models.CharField(max_length=20, choices=Rank.choices, default=Rank.PRIVATE, db_index=True)
    unit         = models.CharField(max_length=120, db_index=True)
    district     = models.CharField(max_length=120, db_index=True)
    status       = models.CharField(max_length=20, choices=Status.choices, default=Status.ON_DUTY, db_index=True)
    phone        = models.CharField(max_length=30, blank=True)
    joined_date  = models.DateField(null=True, blank=True)
    notes        = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["status", "rank"]),
            models.Index(fields=["district"]),
        ]

    def __str__(self) -> str:
        return f"{self.badge_number} — {self.name}"
