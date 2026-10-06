from django.db.models import Q
from django.utils import timezone

from apps.hubkadhigis.models import DisarmamentRecord


def assign_reference_number(record: DisarmamentRecord) -> str:
    """Assign HG-{year}-{id} reference after first save."""
    year = timezone.now().year
    ref = f"HG-{year}-{record.pk:05d}"
    DisarmamentRecord.objects.filter(pk=record.pk).update(reference_number=ref)
    record.reference_number = ref
    return ref
