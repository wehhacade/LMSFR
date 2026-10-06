"""Backfill public.faahfaahinta (incident follow-up narratives) from the raw legacy dump.

The legacy table `faahfaahinta` holds the real narrative descriptions/updates for
each Dhacdooyinka incident (dhacdo_id FK). It was never ported when the
Dhacdooyinka app was built, so incident profiles show no description/details.

Run:
  python manage.py import_faahfaahinta
  python manage.py import_faahfaahinta --dry-run
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection, transaction


def _table_exists(schema: str, table: str) -> bool:
    with connection.cursor() as c:
        c.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = %s AND table_name = %s
            """,
            [schema, table],
        )
        return c.fetchone() is not None


class Command(BaseCommand):
    help = "Import legacy.faahfaahinta (incident narrative updates) into public.faahfaahinta."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report counts without writing.")
        parser.add_argument(
            "--backfill-only",
            action="store_true",
            help="Only copy the first faahfaahin onto dhacdooyinka.tafaasiisha_goobta_dhacdada.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        backfill_only = options["backfill_only"]

        if not backfill_only:
            self._import_rows(dry_run)
        self._backfill_event_descriptions(dry_run)

    def _import_rows(self, dry_run: bool) -> None:
        if not _table_exists("legacy", "faahfaahinta"):
            self.stdout.write(self.style.WARNING("legacy.faahfaahinta not found — nothing to import."))
            return

        with connection.cursor() as c:
            c.execute("SELECT COUNT(*) FROM public.faahfaahinta")
            existing = c.fetchone()[0]

        if existing:
            self.stdout.write(
                self.style.WARNING(
                    f"public.faahfaahinta already has {existing} rows — skipping row import."
                )
            )
            return

        with connection.cursor() as c:
            c.execute(
                """
                SELECT
                    f.id,
                    f.dhacdo_id::bigint AS dhacdo_id,
                    f.fahfaahin,
                    f.status,
                    CASE WHEN f.recorded_by_id ~ '^[0-9]+$'
                         AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = f.recorded_by_id::bigint)
                         THEN f.recorded_by_id::bigint END AS recorded_by_id,
                    f.year,
                    f.month,
                    COALESCE(f.date_recorded::timestamptz, NOW()) AS date_recorded,
                    COALESCE(f.updated_at::timestamptz, f.date_recorded::timestamptz, NOW()) AS updated_at
                FROM legacy.faahfaahinta f
                WHERE f.dhacdo_id ~ '^[0-9]+$'
                  AND EXISTS (SELECT 1 FROM public.dhacdooyinka d WHERE d.id = f.dhacdo_id::bigint)
                  AND f.fahfaahin IS NOT NULL
                  AND BTRIM(f.fahfaahin) <> ''
                ORDER BY f.id
                """
            )
            rows = c.fetchall()

        self.stdout.write(f"Found {len(rows)} legacy narrative rows to import.")
        if dry_run:
            return

        with transaction.atomic():
            with connection.cursor() as c:
                c.executemany(
                    """
                    INSERT INTO public.faahfaahinta
                        (dhacdo_id, fahfaahin, status, recorded_by_id, year, month, date_recorded, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    [
                        (dhacdo_id, fahfaahin, status, recorded_by_id, year, month, date_recorded, updated_at)
                        for (_id, dhacdo_id, fahfaahin, status, recorded_by_id, year, month, date_recorded, updated_at)
                        in rows
                    ],
                )

        self.stdout.write(self.style.SUCCESS(f"Imported {len(rows)} rows into public.faahfaahinta."))

    def _backfill_event_descriptions(self, dry_run: bool) -> None:
        sql = """
            UPDATE public.dhacdooyinka d
            SET tafaasiisha_goobta_dhacdada = src.fahfaahin
            FROM (
                SELECT DISTINCT ON (dhacdo_id)
                    dhacdo_id,
                    fahfaahin
                FROM public.faahfaahinta
                WHERE fahfaahin IS NOT NULL
                  AND BTRIM(fahfaahin) <> ''
                ORDER BY dhacdo_id, date_recorded ASC NULLS LAST, id ASC
            ) src
            WHERE d.id = src.dhacdo_id
              AND (
                    d.tafaasiisha_goobta_dhacdada IS NULL
                    OR BTRIM(d.tafaasiisha_goobta_dhacdada) = ''
              )
        """
        with connection.cursor() as c:
            c.execute(
                """
                SELECT COUNT(*) FROM public.dhacdooyinka d
                WHERE EXISTS (
                    SELECT 1 FROM public.faahfaahinta f
                    WHERE f.dhacdo_id = d.id
                      AND f.fahfaahin IS NOT NULL
                      AND BTRIM(f.fahfaahin) <> ''
                )
                  AND (d.tafaasiisha_goobta_dhacdada IS NULL OR BTRIM(d.tafaasiisha_goobta_dhacdada) = '')
                """
            )
            pending = c.fetchone()[0]

        self.stdout.write(f"{pending} dhacdooyinka rows need event description backfill.")
        if dry_run or pending == 0:
            return

        with connection.cursor() as c:
            c.execute(sql)
            updated = c.rowcount

        from apps.core.cache import invalidate_cache

        invalidate_cache("dhacdooyinka")
        self.stdout.write(self.style.SUCCESS(f"Copied dump faahfaahin onto {updated} dhacdooyinka.tafaasiisha_goobta_dhacdada rows."))
