"""
Seed dhacdooyinka demo data (lookups + incidents + victims).

Usage:
    python manage.py seed_dhacdooyinka
    python manage.py seed_dhacdooyinka --flush
    python manage.py seed_dhacdooyinka --count 30
"""

from __future__ import annotations

import random
from datetime import date, datetime, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import County, Region, SubCounty
from apps.core.cache import invalidate_cache
from apps.dhacdooyinka.models import Dhibanayaashas, Dhacdooyinka, NoocaDhacdooyinkaGuud, NoocaDhaxdooyinka

User = get_user_model()

DEMO_TX_PREFIX = "Txl-SEED-"

QAYBAHA = [
    "Amni",
    "Dhaqaale",
    "Bulsho",
    "Caafimaad",
]

NOOCA_BY_QAYB = {
    "Amni": [
        "Shil",
        "Israsaaseyn ciidan",
        "Dil Qorsheysan",
        "Dhaawac",
        "Weerar hub",
        "Qarax",
    ],
    "Dhaqaale": [
        "Koronto ama Dab",
        "Tuugada",
        "Burbur hanti",
    ],
    "Bulsho": [
        "Dagaal qabiil",
        "Dhibaato bulsho",
        "Dibadbax",
    ],
    "Caafimaad": [
        "Cudur faafaya",
        "Dhaawac caafimaad",
    ],
}

PERPETRATORS = [
    "Shirkada Korontada Muqdis",
    "Mahad C/Laahi",
    "Koox hubeysan",
    "Aadan Muxumed",
    "Hay'adda Biyaha",
    "Ganacsade maxalli ah",
    "Ciidanka amniga",
    "Nabad sugidda degmada",
]

DEMO_EVENTS = [
    {
        "suffix": "2606142137",
        "region": "Banaadir",
        "county": "Garasbaaley",
        "sub_county": "Fooriloow",
        "perpetrator": "Shirkada Korontada Muqdis",
        "type": "Koronto ama Dab",
        "deaths": "0",
        "injuries": "1",
        "damage": "Guri gubtay",
        "days_ago": 18,
    },
    {
        "suffix": "2606121842",
        "region": "Banaadir",
        "county": "Garasbaaley",
        "sub_county": "Fooriloow",
        "perpetrator": "Mahad C/Laahi",
        "type": "Shil",
        "deaths": "0",
        "injuries": "0",
        "damage": "Gaari burburay",
        "days_ago": 20,
    },
    {
        "suffix": "2606100931",
        "region": "Banaadir",
        "county": "Hodan",
        "sub_county": "Horseed",
        "perpetrator": "Koox hubeysan",
        "type": "Israsaaseyn ciidan",
        "deaths": "1",
        "injuries": "1",
        "damage": "",
        "days_ago": 22,
    },
    {
        "suffix": "2606082215",
        "region": "Banaadir",
        "county": "Wadajir",
        "sub_county": "Barwaaqo",
        "perpetrator": "Aadan Muxumed",
        "type": "Dil Qorsheysan",
        "deaths": "1",
        "injuries": "0",
        "damage": "",
        "days_ago": 24,
    },
    {
        "suffix": "2606051544",
        "region": "Banaadir",
        "county": "Hodan",
        "sub_county": "Taleex",
        "perpetrator": "Ganacsade maxalli ah",
        "type": "Dhaawac",
        "deaths": "0",
        "injuries": "2",
        "damage": "Dukaan la dhacay",
        "days_ago": 27,
    },
    {
        "suffix": "2606030812",
        "region": "Banaadir",
        "county": "Kaaraan",
        "sub_county": "Kacaan",
        "perpetrator": "Hay'adda Biyaha",
        "type": "Koronto ama Dab",
        "deaths": "0",
        "injuries": "0",
        "damage": "Biyo daad ah",
        "days_ago": 29,
    },
    {
        "suffix": "2606011933",
        "region": "Banaadir",
        "county": "Waberi",
        "sub_county": "Siinaay",
        "perpetrator": "Ciidanka amniga",
        "type": "Weerar hub",
        "deaths": "2",
        "injuries": "3",
        "damage": "",
        "days_ago": 31,
    },
    {
        "suffix": "2605281147",
        "region": "Banaadir",
        "county": "Hodan",
        "sub_county": "Xalane",
        "perpetrator": "Nabad sugidda degmada",
        "type": "Tuugada",
        "deaths": "0",
        "injuries": "1",
        "damage": "Lacag la dhacay",
        "days_ago": 35,
    },
]


def _find_region(name: str) -> Region | None:
    return Region.objects.filter(name__iexact=name.strip()).first()


def _find_county(name: str, region: Region | None = None) -> County | None:
    qs = County.objects.filter(name__icontains=name.strip())
    if region:
        qs = qs.filter(region=region)
    return qs.first()


def _find_sub_county(name: str, county: County | None = None) -> SubCounty | None:
    qs = SubCounty.objects.filter(name__icontains=name.strip())
    if county:
        qs = qs.filter(county=county)
    return qs.first()


class Command(BaseCommand):
    help = "Seed dhacdooyinka lookups and demo incident records."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help=f"Delete demo rows (tixraac_lambar prefix {DEMO_TX_PREFIX!r}) before seeding.",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=0,
            help="Extra random demo events to generate (in addition to fixed samples).",
        )

    def handle(self, *args, **options):
        if County.objects.count() == 0:
            self.stderr.write(
                self.style.WARNING("No counties found — run: python manage.py seed_locations")
            )

        admin = (
            User.objects.filter(is_admin=True, is_active=True).order_by("id").first()
            or User.objects.filter(is_superuser=True).order_by("id").first()
        )
        if not admin:
            self.stderr.write(self.style.ERROR("No admin user found. Run: python manage.py seed_admin"))
            return

        if options["flush"]:
            self._flush_demo()

        existing = Dhacdooyinka.objects.filter(tixraac_lambar__startswith=DEMO_TX_PREFIX).count()
        if existing and not options["flush"]:
            self.stdout.write(
                self.style.WARNING(
                    f"{existing} demo dhacdooyinka already exist. Use --flush to replace them."
                )
            )
            return

        with transaction.atomic():
            type_map = self._seed_lookups()
            created_events = self._seed_events(type_map, admin, options["count"])

        invalidate_cache("dhacdooyinka")
        self.stdout.write(
            self.style.SUCCESS(
                f"Dhacdooyinka seed complete — {len(type_map)} types, {created_events} events."
            )
        )

    def _flush_demo(self) -> None:
        demo_ids = list(
            Dhacdooyinka.objects.filter(tixraac_lambar__startswith=DEMO_TX_PREFIX).values_list("id", flat=True)
        )
        Dhibanayaashas.objects.filter(dhacdo_id__in=demo_ids).delete()
        deleted, _ = Dhacdooyinka.objects.filter(id__in=demo_ids).delete()
        self.stdout.write(f"Removed {deleted} demo dhacdooyinka rows.")

    def _seed_lookups(self) -> dict[str, NoocaDhaxdooyinka]:
        type_map: dict[str, NoocaDhaxdooyinka] = {}
        for qayb_name in QAYBAHA:
            qayb, _ = NoocaDhacdooyinkaGuud.objects.get_or_create(name=qayb_name)
            for type_name in NOOCA_BY_QAYB.get(qayb_name, []):
                nooca, _ = NoocaDhaxdooyinka.objects.get_or_create(
                    type=type_name,
                    defaults={"nooca_dhacdooyinka_guud": qayb},
                )
                if nooca.nooca_dhacdooyinka_guud_id is None:
                    nooca.nooca_dhacdooyinka_guud = qayb
                    nooca.save(update_fields=["nooca_dhacdooyinka_guud"])
                type_map[type_name] = nooca
        return type_map

    def _seed_events(
        self,
        type_map: dict[str, NoocaDhaxdooyinka],
        admin: User,
        extra_count: int,
    ) -> int:
        created = 0
        rng = random.Random(42)

        for spec in DEMO_EVENTS:
            if self._create_event(spec, type_map, admin):
                created += 1

        counties = list(County.objects.select_related("region")[:40])
        types = list(type_map.values())
        if extra_count and counties and types:
            for i in range(extra_count):
                county = rng.choice(counties)
                sub = county.sub_counties.order_by("?").first()
                nooca = rng.choice(types)
                spec = {
                    "suffix": f"X{1000 + i:04d}",
                    "region": county.region.name if county.region else "",
                    "county": county.name,
                    "sub_county": sub.name if sub else "",
                    "perpetrator": rng.choice(PERPETRATORS),
                    "type": nooca.type or "Shil",
                    "deaths": str(rng.randint(0, 2)),
                    "injuries": str(rng.randint(0, 3)),
                    "damage": rng.choice(["", "Guri", "Gaari", "Dukaan", "Koronto"]),
                    "days_ago": rng.randint(1, 90),
                }
                if self._create_event(spec, type_map, admin):
                    created += 1

        return created

    def _create_event(
        self,
        spec: dict,
        type_map: dict[str, NoocaDhaxdooyinka],
        admin: User,
    ) -> bool:
        tixraac = f"{DEMO_TX_PREFIX}{spec['suffix']}"
        if Dhacdooyinka.objects.filter(tixraac_lambar=tixraac).exists():
            return False

        region = _find_region(spec["region"]) if spec.get("region") else None
        county = _find_county(spec["county"], region) if spec.get("county") else None
        sub_county = _find_sub_county(spec["sub_county"], county) if spec.get("sub_county") else None
        nooca = type_map.get(spec["type"])

        event_date = date.today() - timedelta(days=int(spec.get("days_ago", 7)))
        year = str(event_date.year)
        month = str(event_date.month).zfill(2)

        dhacdo = Dhacdooyinka.objects.create(
            tixraac_lambar=tixraac,
            gobolka=region or (county.region if county and county.region else None),
            degmada=county,
            waaxda=sub_county,
            cidda_fulisay=spec.get("perpetrator", ""),
            nooca_dhacdada=nooca,
            dhimasho=spec.get("deaths", "0"),
            dhaawac=spec.get("injuries", "0"),
            khasaaraha_dhacdada=spec.get("damage", ""),
            tafaasiisha_goobta_dhacdada=spec.get(
                "description",
                f"Dhacdo nooca {spec.get('type', 'aan la aqoon')} — diiwaan demo.",
            ),
            taariikhda_dhacdada=event_date.strftime("%Y-%m-%d"),
            date_opp=event_date,
            year=year,
            month=month,
            latitude="2.0469",
            longitude="45.3182",
            recorded_by=admin,
            is_official=True,
        )
        dhacdo.date_recorded = timezone.make_aware(
            datetime.combine(event_date, datetime.min.time())
        )
        dhacdo.save(update_fields=["date_recorded"])

        deaths = int(spec.get("deaths") or 0)
        injuries = int(spec.get("injuries") or 0)
        victims = deaths + injuries
        for i in range(min(victims, 3)):
            Dhibanayaashas.objects.create(
                dhacdo=dhacdo,
                magaca=f"Dhibane {i + 1}",
                gender=random.choice(["Lab", "Dhedig"]),
                xalada="Dhimasho" if i < deaths else "Dhaawac",
                phone=f"061{random.randint(1000000, 9999999)}",
                recorded_by=admin,
                year=year,
                month=month,
            )
        return True
