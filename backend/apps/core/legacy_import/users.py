"""Import legacy `users` table rows into PostgreSQL v3."""

from __future__ import annotations

from datetime import datetime, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.db import connection, transaction
from django.utils import timezone

from apps.accounts.models import County, Department, Directorate, UserType
from apps.core.legacy_import.timestamps import bulk_create_preserving_timestamps

User = get_user_model()

BOOL_FIELDS = (
    "is_superuser",
    "is_staff",
    "is_active",
    "is_admin",
    "is_officer",
    "is_agent",
    "password_changed",
    "app_pin_changed",
    "suspend",
    "sirdoon",
    "is_mobile",
)

EXTRA_DEFAULTS = {
    "gender": None,
    "is_admin": False,
    "is_officer": False,
    "is_agent": False,
    "password_changed": False,
    "app_pin": None,
    "app_pin_changed": False,
    "suspend": False,
    "sirdoon": False,
    "amni_sir": None,
    "latitude": None,
    "longitude": None,
    "location": None,
    "mobile_type": "Samsung",
    "bio": None,
    "last_login_device": None,
    "login_attempts": 0,
    "lock_until": None,
    "type_of_user": None,
    "is_mobile": False,
}


def _parse_bool(value) -> bool:
    if value is None or value == "":
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in ("1", "true", "yes", "t")


def _parse_dt(value):
    if value in (None, "", "NULL"):
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


def _normalize_row(row: dict) -> dict:
    out = dict(row)
    if "amniSir" in out and out.get("amniSir") not in (None, ""):
        out["amni_sir"] = out["amniSir"]
    return out


def _set_int_fk(user: User, row: dict, field: str, raw_key: str, *, model=None) -> None:
    val = row.get(raw_key)
    if val in (None, "", 0):
        return
    pk = int(val)
    if model is not None and not model.objects.filter(pk=pk).exists():
        return
    setattr(user, field, pk)


def _build_user(row: dict) -> User | None:
    row = _normalize_row(row)
    pk = row.get("id")
    if pk in (None, ""):
        return None
    pk = int(pk)

    user = User(id=pk)
    user.password = row.get("password") or ""
    user.last_login = _parse_dt(row.get("last_login"))
    user.is_superuser = _parse_bool(row.get("is_superuser"))
    user.username = (row.get("username") or f"user{pk}")[:150]
    user.first_name = (row.get("first_name") or "")[:150]
    user.last_name = (row.get("last_name") or "")[:150]
    user.is_staff = _parse_bool(row.get("is_staff"))
    user.is_active = _parse_bool(row.get("is_active", 1))
    user.date_joined = _parse_dt(row.get("date_joined")) or timezone.now()
    user.email = (row.get("email") or f"user{pk}@import.local")[:254]
    user.phone = (row.get("phone") or "")[:50]

    for key, default in EXTRA_DEFAULTS.items():
        if key in BOOL_FIELDS:
            val = _parse_bool(row.get(key)) if row.get(key) is not None else default
        else:
            val = row.get(key) if key in row and row.get(key) not in (None, "") else default
        setattr(user, key, val)

    _set_int_fk(user, row, "county_id", "county_id", model=County)
    _set_int_fk(user, row, "directorate_id", "directorate_id", model=Directorate)
    _set_int_fk(user, row, "department_id", "qaybta_id", model=Department)
    _set_int_fk(user, row, "user_type_id", "user_type_id", model=UserType)

    # Legacy `suspend` mostly tracks agents (is_agent=1), not v3 account suspension.
    user.suspend = False

    return user


def _user_fields(user: User) -> dict:
    return {
        "password": user.password,
        "last_login": user.last_login,
        "is_superuser": user.is_superuser,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_staff": user.is_staff,
        "is_active": user.is_active,
        "date_joined": user.date_joined,
        "email": user.email,
        "phone": user.phone,
        "gender": user.gender,
        "is_admin": user.is_admin,
        "is_officer": user.is_officer,
        "is_agent": user.is_agent,
        "password_changed": user.password_changed,
        "app_pin": user.app_pin,
        "app_pin_changed": user.app_pin_changed,
        "suspend": user.suspend,
        "sirdoon": user.sirdoon,
        "amni_sir": user.amni_sir,
        "latitude": user.latitude,
        "longitude": user.longitude,
        "location": user.location,
        "mobile_type": user.mobile_type,
        "bio": user.bio,
        "last_login_device": user.last_login_device,
        "login_attempts": user.login_attempts,
        "lock_until": user.lock_until,
        "type_of_user": user.type_of_user,
        "is_mobile": user.is_mobile,
        "county_id": user.county_id,
        "directorate_id": user.directorate_id,
        "department_id": user.department_id,
        "user_type_id": user.user_type_id,
    }


def import_users(rows: list[dict], *, truncate: bool = False, batch_size: int = 200) -> dict:
    if truncate:
        with connection.cursor() as c:
            c.execute("TRUNCATE users CASCADE")

    created = updated = skipped = 0
    max_id = 0
    batch_size = max(50, batch_size)
    existing_ids = set(User.objects.values_list("id", flat=True))
    to_create: list[User] = []

    with transaction.atomic():
        for row in rows:
            user = _build_user(row)
            if user is None:
                skipped += 1
                continue
            max_id = max(max_id, user.id)

            if user.id in existing_ids:
                User.objects.filter(pk=user.id).update(**_user_fields(user))
                updated += 1
            else:
                to_create.append(user)
                existing_ids.add(user.id)
                created += 1
                if len(to_create) >= batch_size:
                    bulk_create_preserving_timestamps(User, to_create, batch_size=batch_size)
                    to_create.clear()

        if to_create:
            bulk_create_preserving_timestamps(User, to_create, batch_size=batch_size)

        if max_id:
            with connection.cursor() as c:
                c.execute(
                    "SELECT setval(pg_get_serial_sequence('users', 'id'), %s, true)",
                    [max_id],
                )

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "max_id": max_id,
    }
