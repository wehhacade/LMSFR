"""Seed per-county test rows for top-admin-page period stats (daily / weekly / monthly)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import County, SubCounty
from apps.suspects.models import Suspect, SuspectCase, SuspectStatus

User = get_user_model()

EMAIL_PREFIX = "degmo-test"
CASE_REF_PREFIX = "DTST"
CASE_CODE_PREFIX = "DC"


def _last_thursday(today: date) -> date:
    days_since = (today.weekday() - 3) % 7
    if days_since == 0:
        days_since = 7
    return today - timedelta(days=days_since)


def _at_noon(day: date) -> datetime:
    return timezone.make_aware(datetime.combine(day, time(12, 0)))


class Command(BaseCommand):
    help = (
        "Insert test users, suspects, and cases in every degmo with different counts: "
        "maanta, khamiistii la soo dhaafay (weekly only), isbuucii hore (monthly only)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Remove previous degmo-test / pst- seed rows before inserting.",
        )

    def handle(self, *args, **options):
        if options["flush"]:
            self._flush()
            self.stdout.write(self.style.WARNING("Flushed previous period-stats test data."))

        status = SuspectStatus.objects.first()
        if not status:
            status = SuspectStatus.objects.create(name="Shaki")

        today = timezone.localdate()
        thursday = _last_thursday(today)
        week_ago = today - timedelta(days=8)

        periods = (
            ("maanta", today, lambda cid: (cid % 7) + 1),
            ("khamiis", thursday, lambda cid: (cid % 5) + 1),
            ("week", week_ago, lambda cid: (cid % 4) + 1),
        )

        totals = {"users": 0, "suspects": 0, "cases": 0}

        for county in County.objects.order_by("id"):
            sub_county = SubCounty.objects.filter(county=county).order_by("id").first()
            if not sub_county:
                self.stdout.write(self.style.WARNING(f"Skip {county.name} — no sub_county"))
                continue

            for period_key, period_day, count_fn in periods:
                n = count_fn(county.id)
                ts = _at_noon(period_day)
                for i in range(1, n + 1):
                    user = self._ensure_user(county, period_key, i, ts)
                    suspect = self._ensure_suspect(
                        county, sub_county, status, user, period_key, i, ts
                    )
                    self._ensure_case(county, sub_county, status, user, suspect, period_key, i, ts)
                    totals["users"] += 1
                    totals["suspects"] += 1
                    totals["cases"] += 1

            self.stdout.write(
                f"  {county.id:3d} {county.name:<16} "
                f"maanta={(county.id % 7) + 1} khamiis={(county.id % 5) + 1} week={(county.id % 4) + 1}"
            )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done — {totals['users']} users, {totals['suspects']} suspects, "
            f"{totals['cases']} cases across {County.objects.count()} degmo."
        ))
        self.stdout.write(
            f"Dates: maanta={today} | khamiis={thursday} | isbuucii hore={week_ago}"
        )

    def _flush(self) -> None:
        SuspectCase.objects.filter(case_code__startswith=CASE_CODE_PREFIX).delete()
        Suspect.objects.filter(case_ref__startswith=CASE_REF_PREFIX).delete()
        User.objects.filter(email__startswith=f"{EMAIL_PREFIX}-").delete()
        User.objects.filter(email__startswith="pst-").delete()
        Suspect.objects.filter(case_ref__startswith="PST-").delete()
        SuspectCase.objects.filter(case_code__startswith="PST-").delete()

    def _ensure_user(self, county: County, period: str, index: int, joined_at: datetime) -> User:
        email = f"{EMAIL_PREFIX}-{county.id}-{period}-{index}@lmsbr.test"
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": f"dt_{county.id}_{period}_{index}"[:150],
                "county": county,
                "is_active": True,
            },
        )
        if created:
            user.set_password("testpass12345")
            user.save()
        User.objects.filter(pk=user.pk).update(date_joined=joined_at)
        user.refresh_from_db()
        return user

    def _ensure_suspect(
        self,
        county: County,
        sub_county: SubCounty,
        status: SuspectStatus,
        user: User,
        period: str,
        index: int,
        created_at: datetime,
    ) -> Suspect:
        case_ref = f"{CASE_REF_PREFIX}-{county.id}-{period[:3].upper()}-{index}"
        suspect, created = Suspect.objects.get_or_create(
            case_ref=case_ref,
            defaults={
                "name": f"Test {county.name} {period} {index}",
                "district": county.name,
                "last_seen": timezone.localdate(),
                "offense": "—",
                "suspect_type": status,
                "capture_county": county,
                "capture_sub_county": sub_county,
                "created_by": user,
            },
        )
        Suspect.objects.filter(pk=suspect.pk).update(created_at=created_at)
        suspect.refresh_from_db()
        return suspect

    def _ensure_case(
        self,
        county: County,
        sub_county: SubCounty,
        status: SuspectStatus,
        user: User,
        suspect: Suspect,
        period: str,
        index: int,
        created_at: datetime,
    ) -> SuspectCase:
        case_code = f"{CASE_CODE_PREFIX}{county.id}{period[0].upper()}{index}"[:20]
        case, created = SuspectCase.objects.get_or_create(
            case_code=case_code,
            defaults={
                "suspect": suspect,
                "tuhunka": status,
                "capture_county": county,
                "capture_sub_county": sub_county,
                "created_by": user,
                "description": f"degmo-test {county.name} {period}",
            },
        )
        SuspectCase.objects.filter(pk=case.pk).update(created_at=created_at)
        return case
