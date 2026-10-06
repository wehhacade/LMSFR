"""
Seed Baaris demo data (citizens + wanted).

Usage:
    python manage.py seed_baaris
    python manage.py seed_baaris --flush
    python manage.py seed_baaris --citizens 24 --wanted 8
"""

from __future__ import annotations

import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import County, UserType
from apps.baaris.models import BaarisCitizenProfile
from apps.mobile.models import WantedPerson, WantedType
from apps.suspects.models import Suspect

User = get_user_model()

FIRST = [
    "Cali", "Axmed", "Maxamed", "Xasan", "Cabdi", "Cumar", "Yuusuf", "Ibraahim",
    "Faadumo", "Maryan", "Amina", "Sahra", "Hodan", "Khadra", "Nasteexo", "Aasha",
]
SECOND = [
    "Warsame", "Cali", "Xuseen", "Cabdi", "Maxamuud", "Farax", "Nuur", "Shire",
    "Geele", "Ducaale", "Jaamac", "Samatar",
]
MOTHERS = ["Maryan", "Faadumo", "Amina", "Sahra", "Hawa", "Khadija", "Asha", "Hodan"]
TRIBES = ["Hawiye", "Darood", "Dir", "Rahanweyn", "Isaaq", "Digil"]
JOBS = ["Ganacsade", "Macallin", "Darawal", "Shaqaale", "Iibiye", "Beerale"]
WANTED_TYPES = ["Argagixi", "Dambiile", "La socda", "Shaki", "Tuug"]
PRIORITIES = ["High", "Medium", "Low"]
STATUSES = ["Wanted", "Watch", "Wanted"]


def _phone(i: int) -> str:
    return f"061{1000000 + i:07d}"[:10]


class Command(BaseCommand):
    help = "Seed Baaris citizens + wanted demo records"

    def add_arguments(self, parser):
        parser.add_argument("--flush", action="store_true", help="Remove previous Baaris seed rows first")
        parser.add_argument("--citizens", type=int, default=20)
        parser.add_argument("--wanted", type=int, default=8)

    @transaction.atomic
    def handle(self, *args, **options):
        UserType.objects.get_or_create(name="baaris", defaults={"code": "BAR"})

        user = (
            User.objects.filter(is_superuser=True).first()
            or User.objects.filter(is_agent=True).first()
            or User.objects.first()
        )
        if not user:
            self.stderr.write("No user found — create an admin first.")
            return

        counties = list(County.objects.all()[:16])
        if not counties:
            self.stderr.write("No counties — run seed_locations first.")
            return

        if options["flush"]:
            seed_suspects = Suspect.objects.filter(
                source=Suspect.Source.BAARIS,
                case_ref__startswith="BAR-SEED-",
            )
            n_s = seed_suspects.count()
            BaarisCitizenProfile.objects.filter(suspect__in=seed_suspects).delete()
            seed_suspects.delete()
            n_w = WantedPerson.objects.filter(details__startswith="[SEED]").count()
            WantedPerson.objects.filter(details__startswith="[SEED]").delete()
            self.stdout.write(f"Flushed {n_s} citizens, {n_w} wanted")

        for name in WANTED_TYPES:
            WantedType.objects.get_or_create(name=name)

        today = timezone.now()
        created_c = 0
        for i in range(options["citizens"]):
            phone = _phone(2000 + i)
            if Suspect.objects.filter(phone=phone).exists():
                continue
            county = random.choice(counties)
            days_ago = random.randint(0, 14)
            created_at = today - timedelta(days=days_ago, hours=random.randint(0, 20))
            d = created_at.date()
            name = f"{random.choice(FIRST)} {random.choice(SECOND)}"
            mother = random.choice(MOTHERS)
            job = random.choice(JOBS)
            tribe = random.choice(TRIBES)

            suspect = Suspect(
                name=name,
                mother_name=mother,
                gender=random.choice(["Lab", "Dhedig"]),
                phone=phone,
                occupation=job,
                goobta_shaqada=county.name,
                lambarka_diiwaanka=f"NIRA-{3000 + i}",
                address=county,
                marriage_status=random.choice(["Guursaday", "Doob", "Lamaanaha"]),
                children=random.randint(0, 6),
                tribe=tribe,
                notes="[SEED] Baaris demo citizen",
                offense="Baaris — Aqoonsi",
                district=county.name,
                case_ref=f"BAR-SEED-{i + 1:04d}",
                last_seen=d,
                date_opp=d,
                day=f"{d.day:02d}",
                month=f"{d.month:02d}",
                year=str(d.year),
                created_by=user,
                source=Suspect.Source.BAARIS,
                status=Suspect.Status.WATCHING,
                risk=Suspect.Risk.LOW,
            )
            suspect.save()
            Suspect.objects.filter(pk=suspect.pk).update(created_at=created_at)

            BaarisCitizenProfile.objects.create(
                suspect=suspect,
                waaxda=f"Waax {random.randint(1, 5)}",
                xaafadda=f"Xaafad {random.randint(1, 12)}",
                ijaar_ama_milkiyad=random.choice(["Ijaar", "Milkiyad"]),
                hormuud=phone,
                nuuca_shaqada=job,
                goobta_shaqada=county.name,
                xaaladda_guurka=suspect.marriage_status,
                tirada_carruurta=suspect.children,
                qabiilka=tribe,
                gobolka_kasoo_jeedo=random.choice(["Banaadir", "Hiiraan", "Shabeellaha", "Mudug"]),
                nira=suspect.lambarka_diiwaanka,
                qoraallo_dheeraad="[SEED] Baaris demo citizen",
                form_number=f"SEED-{i + 1:03d}",
                sarkaalka_magaca=user.get_full_name() or user.username,
                goobta_xaqiijinta=county.name,
                created_by=user,
            )
            created_c += 1

        created_w = 0
        for i in range(options["wanted"]):
            phone = _phone(9000 + i)
            if WantedPerson.objects.filter(phone=phone).exists():
                continue
            wtype = WantedType.objects.filter(name=random.choice(WANTED_TYPES)).first()
            WantedPerson.objects.create(
                full_name=f"{random.choice(FIRST)} {random.choice(SECOND)}",
                mother_name=random.choice(MOTHERS),
                phone=phone,
                gender=random.choice(["Lab", "Dhedig"]),
                wanted_type=wtype,
                wanted_status=random.choice(STATUSES),
                priority=random.choice(PRIORITIES),
                details=f"[SEED] Wanted demo — la raadinayo {random.choice(counties).name}",
                created_by=user,
            )
            created_w += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {created_c} baaris citizens, {created_w} wanted "
            f"(total baaris={Suspect.objects.filter(source='baaris').count()}, "
            f"wanted={WantedPerson.objects.count()})"
        ))
