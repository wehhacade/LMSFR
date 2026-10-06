"""Create the InsightFace suspects collection if it is missing."""

from django.core.management.base import BaseCommand, CommandError

from apps.suspects.insightface.client import (
    InsightFaceError,
    collection_id,
    configured,
    create_collection,
    get_collection,
)
from apps.suspects.insightface.service import reset_collection_cache


class Command(BaseCommand):
    help = "Create lmsbr-suspects on InsightFace when it does not exist."

    def add_arguments(self, parser):
        parser.add_argument(
            "--optional",
            action="store_true",
            help="Warn instead of failing when InsightFace is unconfigured or unreachable.",
        )

    def handle(self, *args, **options):
        optional = bool(options.get("optional"))
        if not configured():
            msg = "INSIGHTFACE_BASE_URL and INSIGHTFACE_API_KEY must be set."
            if optional:
                self.stdout.write(self.style.WARNING(f"Skipping InsightFace: {msg}"))
                return
            raise CommandError(msg)

        reset_collection_cache()
        cid = collection_id()
        try:
            existing = get_collection(cid)
        except InsightFaceError as exc:
            if optional:
                self.stdout.write(self.style.WARNING(f"InsightFace unreachable: {exc}"))
                return
            raise CommandError(str(exc)) from exc

        if existing:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Collection already exists: {existing.get('id') or cid} "
                    f"persons={existing.get('person_count')} "
                    f"faces={existing.get('face_count')}"
                )
            )
            return

        try:
            collection = create_collection(cid)
        except InsightFaceError as exc:
            if optional:
                self.stdout.write(self.style.WARNING(f"Could not create collection {cid}: {exc}"))
                return
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"Created collection: {collection.get('id') or cid} "
                f"persons={collection.get('person_count')} "
                f"faces={collection.get('face_count')}"
            )
        )
