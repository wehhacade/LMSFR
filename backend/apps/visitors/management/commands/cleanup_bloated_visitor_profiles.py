from django.core.management.base import BaseCommand

from apps.visitors.services.cleanup import cleanup_bloated_placeholder_profiles


class Command(BaseCommand):
    help = (
        "Move false return visits from placeholder-NIRA merges onto a hidden sink; "
        "clear weak NIRA values. Visit timestamps are preserved."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing.",
        )

    def handle(self, *args, **options):
        result = cleanup_bloated_placeholder_profiles(dry_run=bool(options["dry_run"]))
        self.stdout.write(self.style.SUCCESS(str(result)))
