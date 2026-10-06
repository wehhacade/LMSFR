"""One-off: import legacy `agents` rows (no integer PK in legacy — sequential ids)."""

from django.db import connection, transaction

from apps.accounts.models import Agent, County, Directorate, User
from apps.core.legacy_import.sql_dump import load_sql_file, parse_insert_rows

SPLIT = "/app/data/split"


def lookup(filename, table, key_col, name_col):
    rows = parse_insert_rows(load_sql_file(f"{SPLIT}/{filename}"), table)
    return {int(r[key_col]): str(r.get(name_col) or "") for r in rows if r.get(key_col) not in (None, "")}


tribes = lookup("tribes.sql", "tribes", "tribe_id", "tribe_name")
regions = lookup("region.sql", "region", "region_id", "region_name")
sub_counties = lookup("sub_county.sql", "sub_county", "sub_county_id", "sub_county_name")
sections = lookup("people_section.sql", "people_section", "section_id", "section_name")

rows = parse_insert_rows(load_sql_file(f"{SPLIT}/agents.sql"), "agents")
print(f"Parsed {len(rows)} agent rows")

valid_users = set(User.objects.values_list("pk", flat=True))
valid_counties = set(County.objects.values_list("pk", flat=True))
valid_directorates = set(Directorate.objects.values_list("pk", flat=True))


def text(row, key, max_len=None):
    v = row.get(key)
    s = "" if v in (None, "NULL") else str(v).strip()
    return s[:max_len] if max_len else s


def fk(row, key, valid):
    v = row.get(key)
    try:
        pk = int(v)
    except (TypeError, ValueError):
        return None
    return pk if pk in valid else None


def named(row, key, table):
    v = row.get(key)
    try:
        return table.get(int(v), "")[:200]
    except (TypeError, ValueError):
        return ""


seen_phones = set()
seen_service_ids = set()
seen_users = set()
agents = []
for i, row in enumerate(rows, start=1):
    phone = text(row, "phone", 15) or f"N/A-{i}"
    if phone in seen_phones:
        phone = f"DUP-{i}"
    seen_phones.add(phone)

    service_id = text(row, "service_id", 50) or None
    if service_id in seen_service_ids:
        service_id = f"{service_id}-DUP{i}"[:50]
    if service_id:
        seen_service_ids.add(service_id)

    user_id = fk(row, "user_id", valid_users)
    if user_id in seen_users:
        user_id = None  # OneToOne — keep first link only
    if user_id:
        seen_users.add(user_id)

    agents.append(
        Agent(
            id=i,
            user_id=user_id,
            service_id=service_id,
            first_name=text(row, "first_name", 50),
            father_name=text(row, "father_name", 50),
            last_name=text(row, "last_name", 50),
            fourth_name=text(row, "forth_name", 50),
            mother_name=text(row, "mother_name", 50),
            nickname=text(row, "nickname", 50) or None,
            date_of_birth=text(row, "date_of_birth", 50),
            gender=text(row, "gender", 50) or None,
            phone=phone,
            email=text(row, "email") or None,
            personal_fullname=text(row, "personal_fullname", 200),
            status=text(row, "s_status", 20) or "Active",
            present=text(row, "present", 100) or "Joogey",
            profile=text(row, "profile", 100),
            biography=text(row, "biography") or None,
            weapon_name=text(row, "weapon_name", 200) or None,
            serial_number=text(row, "serial_number", 200) or None,
            tribe_name=named(row, "tribe1_id", tribes) or None,
            region_name=named(row, "region_id", regions) or None,
            county_id=fk(row, "county_id", valid_counties),
            sub_county_name=named(row, "sub_county_id", sub_counties) or None,
            section_name=named(row, "section_id", sections) or None,
            directorate_id=fk(row, "director_id", valid_directorates),
            recorded_by_id=fk(row, "recorded_by_id", valid_users),
        )
    )

with transaction.atomic():
    Agent.objects.bulk_create(agents, batch_size=500)
    with connection.cursor() as c:
        c.execute("SELECT setval(pg_get_serial_sequence('agents', 'id'), %s, true)", [len(agents)])

print(f"Created {len(agents)} agents")
