# Region, County, SubCounty: UUID PK → bigint (legacy MySQL ids). Wipes location rows.

from django.db import migrations, models

LOCATION_TABLES = ("sub_counties", "counties", "regions")
DELETE_MAP = {"a": "NO ACTION", "r": "RESTRICT", "c": "CASCADE", "n": "SET NULL", "d": "SET DEFAULT"}


def _collect_fk_columns(cursor):
    rows: list[tuple[str, str, str, str, str]] = []
    seen: set[tuple[str, str]] = set()
    for ref_table in LOCATION_TABLES:
        cursor.execute(
            """
            SELECT c.conrelid::regclass::text, a.attname, c.confdeltype, c.conname
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.confrelid = %s::regclass AND c.contype = 'f'
            ORDER BY 1, 2
            """,
            [ref_table],
        )
        for table, column, deltype, cname in cursor.fetchall():
            key = (table, column)
            if key in seen:
                continue
            seen.add(key)
            rows.append((table, column, DELETE_MAP.get(deltype, "SET NULL"), cname, ref_table))
    return rows


def forwards(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        raise NotImplementedError("Location PK migration only supports PostgreSQL")

    with schema_editor.connection.cursor() as cursor:
        fk_refs = _collect_fk_columns(cursor)

        cursor.execute("TRUNCATE TABLE regions, counties, sub_counties RESTART IDENTITY CASCADE")

        for table, column, _, cname, _ in fk_refs:
            cursor.execute(f'ALTER TABLE "{table}" DROP CONSTRAINT IF EXISTS "{cname}"')

        for table, column, _, _, _ in fk_refs:
            cursor.execute(f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE bigint USING NULL')

        for loc_table in LOCATION_TABLES:
            cursor.execute(f'ALTER TABLE "{loc_table}" DROP CONSTRAINT IF EXISTS "{loc_table}_pkey" CASCADE')
            cursor.execute(f'ALTER TABLE "{loc_table}" DROP COLUMN IF EXISTS legacy_id')
            cursor.execute(f'ALTER TABLE "{loc_table}" DROP COLUMN IF EXISTS id')
            cursor.execute(f'ALTER TABLE "{loc_table}" ADD COLUMN id BIGSERIAL PRIMARY KEY')

        for table, column, on_delete, _, ref_table in fk_refs:
            constraint = f"{table}_{column}_fk_{ref_table}"
            cursor.execute(
                f"""
                ALTER TABLE "{table}"
                ADD CONSTRAINT "{constraint}"
                FOREIGN KEY ("{column}") REFERENCES "{ref_table}"(id) ON DELETE {on_delete}
                """
            )

        for loc_table in LOCATION_TABLES:
            cursor.execute(
                f"SELECT setval(pg_get_serial_sequence('{loc_table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM \"{loc_table}\"), 1), true)"
            )


def backwards(apps, schema_editor):
    raise RuntimeError("Cannot reverse location PK migration — restore from backup if needed.")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0011_lookup_legacy_id"),
        ("suspects", "0012_legacy_table_names"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(forwards, backwards)],
            state_operations=[
                migrations.RemoveField(model_name="region", name="legacy_id"),
                migrations.RemoveField(model_name="county", name="legacy_id"),
                migrations.RemoveField(model_name="subcounty", name="legacy_id"),
                migrations.AlterField(
                    model_name="region",
                    name="id",
                    field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False),
                ),
                migrations.AlterField(
                    model_name="county",
                    name="id",
                    field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False),
                ),
                migrations.AlterField(
                    model_name="subcounty",
                    name="id",
                    field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False),
                ),
            ],
        ),
    ]
