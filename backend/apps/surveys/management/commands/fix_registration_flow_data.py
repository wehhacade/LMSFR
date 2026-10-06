"""Fix Howlwadaag wards and set CCTV survey question display order.

Usage:
  python manage.py fix_registration_flow_data
  python manage.py fix_registration_flow_data --dry-run
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import County, SubCounty
from apps.core.cache import invalidate_cache
from apps.surveys.models import Question, Survey, SurveySection

HOWLWADAAG_WARDS = [
    ("Sayidka", "SAY"),
    ("Saqaawadiin", "SQW"),
    ("Xaawo Taako", "XWT"),
    ("Axmed Gurey", "AXG"),
]

PERSONAL_QUESTION_TEXTS = {
    "MAGACA MILKILAHA",
    "TALEEFINKA MILKIILAHA",
    "MAGACA WAKIILKA GURIGA",
    "TALEEFANKA WAKIILKA",
}
FINAL_QUESTION_TEXTS = {
    "CABASHO MA JIRTAA",
    "NUUCA CABASHADA",
}

CCTV_SECTIONS = [
    (0, "Macluumaadka shakhsiyeed", "personal"),
    (1, "Su'aalaha kaamirada", "camera"),
    (2, "Macluumaadka ugu dambeeya", "final"),
]

# Question text → display order within its stage (and global sort).
CCTV_QUESTION_ORDER = {
    "MAGACA MILKILAHA": 10,
    "TALEEFINKA MILKIILAHA": 15,
    "MAGACA WAKIILKA GURIGA": 20,
    "TALEEFANKA WAKIILKA": 30,
    "NUUCA GURIGA": 100,
    "KAAMIRO MA XIRAN TAHAY": 110,
    "MASHAQEYNEYSAA KAAMIRADA": 120,
    "NUUCA KAAMIRADA": 130,
    "HDD SIZE": 140,
    "STORAGE TIME": 150,
    "TAYADA": 160,
    "KAAMIRADA BANAANKA SI SAXAN MA U XIRANTAHAY": 170,
    "HABEEN MA SHAQEYNEYSAA": 180,
    "MAGACA GOOBTA (AREA)": 190,
    "MAGACA DAMIINKA WAQTIGA LA XIRAAYO KAAMIRADA": 200,
    "TALEEFANKA DAMIINKA": 210,
    "CABASHO MA JIRTAA": 300,
    "NUUCA CABASHADA": 310,
}

FK_NULL_TARGETS = [
    ("surveys_response", "sub_county_id"),
    ("damiinada", "sub_county_id"),
    ("dhacdooyinka", "waaxda_id"),
    ("people_sections", "sub_county_id"),
    ("suspectcase", "capture_sub_county_id"),
    ("suspects", "capture_sub_county_id"),
]


class Command(BaseCommand):
    help = "Fix Howlwadaag wards and CCTV survey question ordering."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print changes without writing.",
        )

    def handle(self, *args, **options):
        dry = options["dry_run"]
        with transaction.atomic():
            self._fix_howlwadaag(dry)
            self._fix_cctv_sections_and_order(dry)
            if dry:
                self.stdout.write(self.style.WARNING("Dry run — rolling back."))
                transaction.set_rollback(True)
            else:
                invalidate_cache("survey")
                self.stdout.write("  survey cache invalidated")

    def _fix_howlwadaag(self, dry: bool) -> None:
        county = (
            County.objects.filter(name__iexact="Howlwadaag").first()
            or County.objects.filter(name__icontains="Howlwadaag").first()
        )
        if not county:
            self.stdout.write(self.style.ERROR("Howlwadaag county not found."))
            return

        keep_ids: list[int] = []
        for name, code in HOWLWADAAG_WARDS:
            existing = SubCounty.objects.filter(county=county, name__iexact=name).first()
            if existing:
                keep_ids.append(existing.pk)
                if existing.code != code and not dry:
                    existing.code = code
                    existing.save(update_fields=["code"])
                self.stdout.write(f"  keep ward id={existing.pk} {existing.name!r}")
                continue

            # Prefer renaming an unused/duplicate Howlwadaag ward to avoid gaps.
            target_names = {n.lower() for n, _ in HOWLWADAAG_WARDS}
            candidate = None
            for row in (
                SubCounty.objects.filter(county=county)
                .exclude(id__in=keep_ids)
                .order_by("id")
            ):
                if row.name.strip().lower() not in target_names:
                    candidate = row
                    break
            if candidate:
                self.stdout.write(
                    f"  rename id={candidate.pk} {candidate.name!r} → {name!r}"
                )
                if not dry:
                    candidate.name = name
                    candidate.code = code
                    candidate.save(update_fields=["name", "code"])
                keep_ids.append(candidate.pk)
            else:
                self.stdout.write(f"  create ward {name!r}")
                if not dry:
                    created = SubCounty.objects.create(
                        county=county, name=name, code=code
                    )
                    keep_ids.append(created.pk)

        obsolete = SubCounty.objects.filter(county=county).exclude(id__in=keep_ids)
        obsolete_ids = list(obsolete.values_list("id", flat=True))
        if not obsolete_ids:
            self.stdout.write("  no obsolete Howlwadaag wards")
            return

        self.stdout.write(f"  nullify FKs + delete obsolete ids={obsolete_ids}")
        if dry:
            return

        from django.db import connection

        with connection.cursor() as cursor:
            for table, column in FK_NULL_TARGETS:
                cursor.execute(
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_name = %s LIMIT 1",
                    [table],
                )
                if not cursor.fetchone():
                    continue
                cursor.execute(
                    f"UPDATE {table} SET {column} = NULL WHERE {column} IN %s",
                    [tuple(obsolete_ids)],
                )
        deleted, _ = obsolete.delete()
        self.stdout.write(self.style.SUCCESS(f"  deleted {deleted} obsolete wards"))

        final = list(
            SubCounty.objects.filter(county=county).order_by("name").values_list("name", flat=True)
        )
        self.stdout.write(f"  Howlwadaag wards now: {final}")

    def _fix_cctv_sections_and_order(self, dry: bool) -> None:
        survey = (
            Survey.objects.filter(name__iexact="XOGTA KAAMIROOYINKA DEGMOOYINKA").first()
            or Survey.objects.filter(pk=1).first()
        )
        if not survey:
            self.stdout.write(self.style.ERROR("CCTV survey not found."))
            return

        # Ensure the three registration sections exist.
        section_by_kind: dict[str, SurveySection] = {}
        for order, title, kind in CCTV_SECTIONS:
            existing = (
                SurveySection.objects.filter(survey=survey, title__iexact=title).first()
                or SurveySection.objects.filter(survey=survey, order=order).first()
            )
            if existing:
                if not dry and (existing.title != title or existing.order != order):
                    existing.title = title
                    existing.order = order
                    existing.save(update_fields=["title", "order"])
                section_by_kind[kind] = existing
                self.stdout.write(f"  section keep id={existing.pk} {title!r}")
            else:
                self.stdout.write(f"  section create {title!r}")
                if dry:
                    # Placeholder so dry-run assignment logs still work.
                    section_by_kind[kind] = SurveySection(survey=survey, title=title, order=order)
                else:
                    section_by_kind[kind] = SurveySection.objects.create(
                        survey=survey, title=title, order=order
                    )

        questions = list(
            Question.objects.filter(section__survey=survey).select_related("section")
        )
        moved = 0
        ordered = 0
        for q in questions:
            key = q.text.strip().upper()
            if key in PERSONAL_QUESTION_TEXTS:
                kind = "personal"
            elif key in FINAL_QUESTION_TEXTS:
                kind = "final"
            else:
                kind = "camera"
            target = section_by_kind[kind]
            new_order = CCTV_QUESTION_ORDER.get(q.text.strip(), q.order)

            if dry:
                target_id = getattr(target, "pk", None)
                if target_id is None or q.section_id != target_id:
                    self.stdout.write(f"  move q={q.id} → {kind} {q.text!r}")
                    moved += 1
                if q.order != new_order:
                    ordered += 1
                continue

            updates = {}
            if q.section_id != target.pk:
                updates["section_id"] = target.pk
                moved += 1
                self.stdout.write(
                    f"  move q={q.id} → section {target.pk} ({kind}) {q.text!r}"
                )
            if q.order != new_order:
                updates["order"] = new_order
                ordered += 1
            if updates:
                Question.objects.filter(pk=q.pk).update(**updates)

        # Normalize order within each section to 0..n-1 for clean admin drag-drop.
        if not dry:
            for kind, section in section_by_kind.items():
                qs = list(
                    Question.objects.filter(section=section).order_by("order", "id")
                )
                for i, q in enumerate(qs):
                    if q.order != i:
                        Question.objects.filter(pk=q.pk).update(order=i)

        # Drop empty leftover sections (old single CCTV section, etc.).
        if not dry:
            for leftover in SurveySection.objects.filter(survey=survey).exclude(
                id__in=[s.pk for s in section_by_kind.values() if s.pk]
            ):
                if leftover.questions.exists():
                    continue
                self.stdout.write(f"  delete empty section id={leftover.pk} {leftover.title!r}")
                leftover.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"  CCTV sections ready — moved {moved}, order updates {ordered}"
            )
        )
