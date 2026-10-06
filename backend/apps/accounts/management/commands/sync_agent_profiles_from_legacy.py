"""Copy Agent/User profile paths from legacy tables (matched by user_id)."""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Restore public.agents.profile and public.users.profile from legacy by user_id."

    def handle(self, *args, **options):
        with connection.cursor() as c:
            c.execute(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'legacy' AND table_name = 'agents'
                """
            )
            if not c.fetchone():
                self.stderr.write(self.style.ERROR("legacy.agents not found"))
                return

            c.execute(
                """
                UPDATE public.agents a
                SET profile = LEFT(BTRIM(l.profile), 100)
                FROM legacy.agents l
                WHERE l.user_id ~ '^[0-9]+$'
                  AND a.user_id = l.user_id::bigint
                  AND l.profile IS NOT NULL
                  AND BTRIM(l.profile) <> ''
                  AND l.profile <> 'NULL'
                  AND (
                    a.profile IS NULL
                    OR BTRIM(a.profile::text) = ''
                    OR a.profile::text = 'NULL'
                  )
                """
            )
            agents_updated = c.rowcount

            users_updated = 0
            c.execute(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'legacy' AND table_name = 'users'
                """
            )
            if c.fetchone():
                c.execute(
                    """
                    UPDATE public.users u
                    SET profile = LEFT(BTRIM(l.profile), 100)
                    FROM legacy.users l
                    WHERE l.id ~ '^[0-9]+$'
                      AND u.id = l.id::bigint
                      AND l.profile IS NOT NULL
                      AND BTRIM(l.profile::text) <> ''
                      AND l.profile::text <> 'NULL'
                      AND (
                        u.profile IS NULL
                        OR BTRIM(u.profile::text) = ''
                        OR u.profile::text = 'NULL'
                      )
                    """
                )
                users_updated = c.rowcount

            # Keep login user photo in sync with agent photo when user still empty.
            c.execute(
                """
                UPDATE public.users u
                SET profile = LEFT(BTRIM(a.profile::text), 100)
                FROM public.agents a
                WHERE a.user_id = u.id
                  AND a.profile IS NOT NULL
                  AND BTRIM(a.profile::text) <> ''
                  AND a.profile::text <> 'NULL'
                  AND (
                    u.profile IS NULL
                    OR BTRIM(u.profile::text) = ''
                    OR u.profile::text = 'NULL'
                  )
                """
            )
            users_from_agents = c.rowcount

            c.execute(
                """
                SELECT COUNT(*) FROM public.agents
                WHERE profile IS NOT NULL AND BTRIM(profile::text) <> ''
                """
            )
            agents_total = c.fetchone()[0]
            c.execute(
                """
                SELECT COUNT(*) FROM public.users
                WHERE profile IS NOT NULL AND BTRIM(profile::text) <> ''
                """
            )
            users_total = c.fetchone()[0]

        self.stdout.write(
            self.style.SUCCESS(
                f"Agents updated={agents_updated} (with photo={agents_total}); "
                f"users updated={users_updated}+{users_from_agents} (with photo={users_total})."
            )
        )
