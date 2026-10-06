"""
Import legacy MySQL `users` into PostgreSQL v3 (integer id + password hash preserved).

Prefer the unified command (table name only):
  python manage.py import_legacy users
  python manage.py import_legacy users --truncate

Sources (pick one):
  1) Live MySQL  — only if port 3306 is reachable (often blocked on lmsbr.com)
  2) CSV export  — phpMyAdmin → Export → CSV (recommended)

Examples:
  python manage.py import_legacy_users --csv-file data/users.csv --dry-run
  python manage.py import_legacy_users --csv-file data/users.csv --truncate
  python manage.py import_legacy_users --host=127.0.0.1 --database=lmsbr_prod_latest --user=root --password=...
"""

from __future__ import annotations

import csv
import os
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from apps.accounts.models import County, Department, Directorate, UserType

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

COLUMN_ALIASES = {
    "amniSir": "amni_sir",
    "amni_sir": "amni_sir",
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
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _normalize_row(row: dict) -> dict:
    out = {}
    for key, value in row.items():
        if key is None:
            continue
        name = COLUMN_ALIASES.get(key, key)
        if value == "" or value == "NULL":
            value = None
        out[name] = value
    return out


def _load_csv(path: Path, limit: int) -> list[dict]:
    rows: list[dict] = []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for i, row in enumerate(reader):
            if limit and i >= limit:
                break
            rows.append(_normalize_row(row))
    return rows


@contextmanager
def mysql_connection(host, port, database, user, password):
    try:
        import pymysql
    except ImportError as exc:
        raise CommandError("Install PyMySQL: pip install pymysql") from exc

    try:
        conn = pymysql.connect(
            host=host,
            port=int(port),
            user=user,
            password=password,
            database=database,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=15,
        )
    except Exception as exc:
        raise CommandError(
            f"MySQL connection failed ({host}:{port}/{database}): {exc}\n"
            "Tip: lmsbr.com MySQL is usually not open on 3306 — export CSV from phpMyAdmin instead."
        ) from exc
    try:
        yield conn
    finally:
        conn.close()


def _load_mysql(host, port, database, user, password, limit: int) -> list[dict]:
    with mysql_connection(host, port, database, user, password) as mysql:
        with mysql.cursor() as cur:
            sql = "SELECT * FROM users ORDER BY id"
            if limit:
                sql += f" LIMIT {int(limit)}"
            cur.execute(sql)
            return [_normalize_row(r) for r in cur.fetchall()]


def _build_user(row: dict) -> User | None:
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
    user.date_joined = _parse_dt(row.get("date_joined")) or datetime.now()
    user.email = (row.get("email") or f"user{pk}@import.local")[:254]
    user.phone = (row.get("phone") or "")[:50]

    for key, default in EXTRA_DEFAULTS.items():
        if key in BOOL_FIELDS:
            val = _parse_bool(row.get(key)) if row.get(key) is not None else default
        else:
            val = row.get(key) if key in row and row.get(key) not in (None, "") else default
        setattr(user, key, val)

    if row.get("amniSir") not in (None, ""):
        user.amni_sir = str(row["amniSir"])[:300]

    legacy_county = row.get("county_id")
    if legacy_county not in (None, "", "0", 0):
        pk = int(legacy_county)
        if County.objects.filter(pk=pk).exists():
            user.county_id = pk

    for field, key, model in (
        ("directorate_id", "directorate_id", Directorate),
        ("department_id", "qaybta_id", Department),
        ("user_type_id", "user_type_id", UserType),
    ):
        val = row.get(key)
        if val not in (None, "", "0", 0):
            pk = int(val)
            if model.objects.filter(pk=pk).exists():
                setattr(user, field, pk)

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
    }


class Command(BaseCommand):
    help = "Import legacy users (MySQL live or phpMyAdmin CSV) into PostgreSQL v3."

    def add_arguments(self, parser):
        parser.add_argument("--csv-file", default="", help="Path to phpMyAdmin CSV export of users table")
        parser.add_argument("--host", default=os.environ.get("LEGACY_MYSQL_HOST", "127.0.0.1"))
        parser.add_argument("--port", default=os.environ.get("LEGACY_MYSQL_PORT", "3306"))
        parser.add_argument("--database", default=os.environ.get("LEGACY_MYSQL_DB", "lmsbr_prod_latest"))
        parser.add_argument("--user", default=os.environ.get("LEGACY_MYSQL_USER", "root"))
        parser.add_argument("--password", default=os.environ.get("LEGACY_MYSQL_PASSWORD", ""))
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--limit", type=int, default=0, help="Max rows (0 = all)")
        parser.add_argument("--truncate", action="store_true", help="TRUNCATE users CASCADE before import")
        parser.add_argument("--batch-size", type=int, default=200)

    def handle(self, *args, **options):
        limit = int(options["limit"] or 0)
        csv_file = (options["csv_file"] or "").strip()

        if csv_file:
            path = Path(csv_file)
            if not path.is_file():
                raise CommandError(f"CSV not found: {path}")
            rows = _load_csv(path, limit)
            source = f"CSV {path}"
        else:
            rows = _load_mysql(
                options["host"],
                options["port"],
                options["database"],
                options["user"],
                options["password"],
                limit,
            )
            source = f"MySQL {options['host']}/{options['database']}"

        if not rows:
            self.stdout.write(self.style.WARNING("No users found."))
            return

        self.stdout.write(f"Loaded {len(rows)} rows from {source}")

        if options["dry_run"]:
            sample = rows[0]
            keys = sorted(sample.keys())
            self.stdout.write(f"Columns ({len(keys)}): {', '.join(keys[:20])}{'…' if len(keys) > 20 else ''}")
            self.stdout.write(
                f"Sample id={sample.get('id')} username={sample.get('username')} email={sample.get('email')}"
            )
            return

        if options["truncate"]:
            with connection.cursor() as c:
                c.execute("TRUNCATE users CASCADE")
            self.stdout.write(self.style.WARNING("Truncated users (CASCADE)"))

        created = updated = skipped = 0
        max_id = 0
        batch_size = max(50, int(options["batch_size"]))
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
                        User.objects.bulk_create(to_create, batch_size=batch_size)
                        to_create.clear()

            if to_create:
                User.objects.bulk_create(to_create, batch_size=batch_size)

            if max_id:
                with connection.cursor() as c:
                    c.execute(
                        "SELECT setval(pg_get_serial_sequence('users', 'id'), %s, true)",
                        [max_id],
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done — created={created} updated={updated} skipped={skipped} max_id={max_id}"
            )
        )
