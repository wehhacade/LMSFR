"""Copy legacy.user_location GPS tracks into public.user_location.

Django's auto_now on last_updated would wipe dump timestamps if we used ORM
save()/bulk_create, so this uses raw SQL and keeps Africa/Mogadishu times.
Also backfills users.latitude / users.longitude from the latest track (then
legacy.users) so Amniga GPS and agent profiles can plot every field agent.

Run:
  python manage.py import_user_locations
  python manage.py import_user_locations --dry-run
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection


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


def _count(sql: str, params: tuple = ()) -> int:
    with connection.cursor() as c:
        c.execute(sql, params)
        row = c.fetchone()
        return int(row[0] if row else 0)


class Command(BaseCommand):
    help = "Import legacy.user_location GPS tracks and backfill user lat/lng."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report counts without writing.")

    def handle(self, *args, **options):
        dry = bool(options.get("dry_run"))
        if not _table_exists("legacy", "user_location"):
            public_count = _count("SELECT COUNT(*) FROM public.user_location") if _table_exists("public", "user_location") else 0
            self.stdout.write(self.style.WARNING(
                f"legacy.user_location not found — public.user_location has {public_count} rows."
            ))
            return

        legacy_count = _count("SELECT COUNT(*) FROM legacy.user_location")
        public_before = _count("SELECT COUNT(*) FROM public.user_location")
        self.stdout.write(f"legacy.user_location={legacy_count} public.user_location={public_before}")

        if dry:
            self.stdout.write(self.style.WARNING("Dry run — no rows written."))
            return

        with connection.cursor() as c:
            c.execute(
                """
                INSERT INTO public.user_location
                    (id, user_id, suspect_id, latitude, longitude, last_updated, reg_day, year, month)
                SELECT
                    l.id::bigint,
                    CASE
                        WHEN l.user_id ~ '^[0-9]+$'
                             AND l.user_id::bigint <> 0
                             AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = l.user_id::bigint)
                        THEN l.user_id::bigint
                        ELSE NULL
                    END,
                    CASE
                        WHEN l.suspect_id ~ '^[0-9]+$'
                             AND l.suspect_id::bigint <> 0
                             AND EXISTS (SELECT 1 FROM public.suspects s WHERE s.id = l.suspect_id::bigint)
                        THEN l.suspect_id::bigint
                        ELSE NULL
                    END,
                    NULLIF(BTRIM(l.latitude), '')::double precision,
                    NULLIF(BTRIM(l.longitude), '')::double precision,
                    CASE
                        WHEN l.last_updated IS NULL
                             OR BTRIM(l.last_updated) IN ('', 'NULL', '0')
                        THEN NOW()
                        ELSE (l.last_updated::timestamp AT TIME ZONE 'Africa/Mogadishu')
                    END,
                    COALESCE(l.reg_day, ''),
                    COALESCE(l.year, ''),
                    COALESCE(l.month, '')
                FROM legacy.user_location l
                WHERE l.id ~ '^[0-9]+$'
                ON CONFLICT (id) DO NOTHING
                """
            )
            inserted = c.rowcount

            c.execute(
                """
                SELECT setval(
                    pg_get_serial_sequence('public.user_location', 'id'),
                    COALESCE((SELECT MAX(id) FROM public.user_location), 1),
                    true
                )
                """
            )

            c.execute(
                """
                UPDATE public.users u
                SET latitude = sub.latitude::text,
                    longitude = sub.longitude::text
                FROM (
                    SELECT DISTINCT ON (user_id)
                        user_id,
                        latitude,
                        longitude
                    FROM public.user_location
                    WHERE user_id IS NOT NULL
                      AND latitude IS NOT NULL
                      AND longitude IS NOT NULL
                      AND NOT (ABS(latitude) < 0.01 AND ABS(longitude) < 0.01)
                    ORDER BY user_id, last_updated DESC
                ) sub
                WHERE u.id = sub.user_id
                  AND (
                    u.latitude IS NULL OR BTRIM(u.latitude) IN ('', '0', '0.0')
                    OR u.longitude IS NULL OR BTRIM(u.longitude) IN ('', '0', '0.0')
                  )
                """
            )
            backfilled_tracks = c.rowcount

            backfilled_users = 0
            if _table_exists("legacy", "users"):
                c.execute(
                    """
                    UPDATE public.users u
                    SET latitude = NULLIF(BTRIM(l.latitude), ''),
                        longitude = NULLIF(BTRIM(l.longitude), '')
                    FROM legacy.users l
                    WHERE l.id ~ '^[0-9]+$'
                      AND u.id = l.id::bigint
                      AND l.latitude IS NOT NULL
                      AND BTRIM(l.latitude) NOT IN ('', '0', '0.0', 'NULL')
                      AND l.longitude IS NOT NULL
                      AND BTRIM(l.longitude) NOT IN ('', '0', '0.0', 'NULL')
                      AND (
                        u.latitude IS NULL OR BTRIM(u.latitude) IN ('', '0', '0.0')
                        OR u.longitude IS NULL OR BTRIM(u.longitude) IN ('', '0', '0.0')
                      )
                    """
                )
                backfilled_users = c.rowcount

        public_after = _count("SELECT COUNT(*) FROM public.user_location")
        with_coords = _count(
            """
            SELECT COUNT(*) FROM public.users
            WHERE latitude IS NOT NULL AND BTRIM(latitude) NOT IN ('', '0', '0.0')
              AND longitude IS NOT NULL AND BTRIM(longitude) NOT IN ('', '0', '0.0')
            """
        )
        self.stdout.write(self.style.SUCCESS(
            f"Imported {inserted} user_location rows "
            f"(public now {public_after}); "
            f"backfilled coords from tracks={backfilled_tracks} "
            f"legacy.users={backfilled_users}; "
            f"users with lat/lng={with_coords}."
        ))
