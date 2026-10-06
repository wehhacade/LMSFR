"""InsightFace adapter for TipPhone + React Native suspect APIs.

Mobile clients keep calling /face-match and /face-embedding. Django holds the
API key and talks to the suspects collection.
"""

from .service import (
    enroll_suspect_image,
    insightface_enabled,
    person_id_for_suspect,
    reset_collection_cache,
    search_suspects_by_image,
    unenroll_suspect,
)

__all__ = [
    "enroll_suspect_image",
    "insightface_enabled",
    "person_id_for_suspect",
    "reset_collection_cache",
    "search_suspects_by_image",
    "unenroll_suspect",
]
