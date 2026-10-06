"""Copy dump `faahfaahinta.fahfaahin` onto dhacdooyinka.tafaasiisha_goobta_dhacdada."""

from __future__ import annotations

from datetime import datetime, timezone as dt_timezone

from django.db import connection
from django.db.models import OuterRef, Q, Subquery
from django.utils import timezone

from apps.dhacdooyinka.models import Dhacdooyinka, Faahfaahinta


def _legacy_faahfaahinta_exists() -> bool:
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'legacy' AND table_name = 'faahfaahinta'
            )
            """
        )
        return bool(cur.fetchone()[0])


def _parse_dt(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip()
        dt = None
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
        if dt is None:
            return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, dt_timezone.utc)
    return dt


def import_faahfaahinta_from_legacy() -> dict:
    """Copy legacy.faahfaahinta → public.faahfaahinta when the dump was loaded raw."""
    if not _legacy_faahfaahinta_exists():
        return {"created": 0, "updated": 0, "skipped": 0, "source": None}

    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT id, fahfaahin, year, month, status, date_recorded, updated_at,
                   dhacdo_id, recorded_by_id
            FROM legacy.faahfaahinta
            """
        )
        columns = [col[0] for col in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]

    event_ids = set(Dhacdooyinka.objects.values_list("pk", flat=True))
    existing = {pk: obj for pk, obj in Faahfaahinta.objects.in_bulk()}
    created = updated = skipped = 0
    now = timezone.now()

    for row in rows:
        try:
            pk = int(row["id"])
        except (TypeError, ValueError):
            skipped += 1
            continue
        dhacdo_id = row.get("dhacdo_id")
        try:
            dhacdo_id = int(dhacdo_id) if dhacdo_id not in (None, "") else None
        except (TypeError, ValueError):
            dhacdo_id = None
        if dhacdo_id is not None and dhacdo_id not in event_ids:
            dhacdo_id = None

        recorded_by_id = row.get("recorded_by_id")
        try:
            recorded_by_id = int(recorded_by_id) if recorded_by_id not in (None, "") else None
        except (TypeError, ValueError):
            recorded_by_id = None
        if recorded_by_id is not None:
            with connection.cursor() as cur:
                cur.execute("SELECT 1 FROM public.users WHERE id = %s", [recorded_by_id])
                if cur.fetchone() is None:
                    recorded_by_id = None

        date_recorded = _parse_dt(row.get("date_recorded")) or now
        updated_at = _parse_dt(row.get("updated_at")) or date_recorded
        payload = {
            "fahfaahin": row.get("fahfaahin") or None,
            "year": row.get("year") or None,
            "month": row.get("month") or None,
            "status": row.get("status") or None,
            "date_recorded": date_recorded,
            "updated_at": updated_at,
            "dhacdo_id": dhacdo_id,
            "recorded_by_id": recorded_by_id,
        }
        obj = existing.get(pk)
        if obj is None:
            with connection.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.faahfaahinta
                        (id, dhacdo_id, fahfaahin, status, recorded_by_id, year, month, date_recorded, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    [
                        pk,
                        payload["dhacdo_id"],
                        payload["fahfaahin"],
                        payload["status"],
                        recorded_by_id,
                        payload["year"],
                        payload["month"],
                        payload["date_recorded"],
                        payload["updated_at"],
                    ],
                )
            created += 1
        else:
            with connection.cursor() as cur:
                cur.execute(
                    """
                    UPDATE public.faahfaahinta
                    SET dhacdo_id = %s, fahfaahin = %s, status = %s, recorded_by_id = %s,
                        year = %s, month = %s, date_recorded = %s, updated_at = %s
                    WHERE id = %s
                    """,
                    [
                        payload["dhacdo_id"],
                        payload["fahfaahin"],
                        payload["status"],
                        recorded_by_id,
                        payload["year"],
                        payload["month"],
                        payload["date_recorded"],
                        payload["updated_at"],
                        pk,
                    ],
                )
            updated += 1

    if rows:
        max_id = max(int(r["id"]) for r in rows if r.get("id") not in (None, ""))
        with connection.cursor() as cur:
            cur.execute(
                "SELECT setval(pg_get_serial_sequence(%s, %s), %s, true)",
                ["faahfaahinta", "id", max_id],
            )

    return {"created": created, "updated": updated, "skipped": skipped, "source": "legacy.faahfaahinta"}


def backfill_tafaasiisha_from_faahfaahinta() -> int:
    """Copy the earliest fahfaahin per event into tafaasiisha when empty."""
    first = (
        Faahfaahinta.objects.filter(dhacdo_id=OuterRef("pk"))
        .exclude(fahfaahin__isnull=True)
        .exclude(fahfaahin__exact="")
        .order_by("date_recorded", "id")
    )
    return Dhacdooyinka.objects.filter(
        Q(tafaasiisha_goobta_dhacdada__isnull=True) | Q(tafaasiisha_goobta_dhacdada="")
    ).update(tafaasiisha_goobta_dhacdada=Subquery(first.values("fahfaahin")[:1]))
