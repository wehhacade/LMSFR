"""Sync dump faahfaahinta → v3 tafaasiisha + public.faahfaahinta."""

from django.core.management.base import BaseCommand

from apps.dhacdooyinka.models import Faahfaahinta
from apps.dhacdooyinka.services.faahfaahin import (
    backfill_tafaasiisha_from_faahfaahinta,
    import_faahfaahinta_from_legacy,
)


class Command(BaseCommand):
    help = (
        "Copy legacy.faahfaahinta into public.faahfaahinta if needed, "
        "then set dhacdooyinka.tafaasiisha_goobta_dhacdada from the first fahfaahin."
    )

    def handle(self, *args, **options):
        if Faahfaahinta.objects.count() == 0:
            stats = import_faahfaahinta_from_legacy()
            self.stdout.write(
                f"legacy.faahfaahinta → public.faahfaahinta "
                f"created={stats['created']} updated={stats['updated']} "
                f"skipped={stats['skipped']} source={stats['source']}"
            )
        else:
            self.stdout.write(f"public.faahfaahinta already has {Faahfaahinta.objects.count()} rows")

        updated = backfill_tafaasiisha_from_faahfaahinta()
        self.stdout.write(self.style.SUCCESS(f"Backfilled tafaasiisha on {updated} dhacdooyinka rows"))
