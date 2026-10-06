# Convert remaining UUID primary keys → bigint (legacy MySQL style). Wipes agent/lookup/audit rows.

from django.db import migrations, models

DELETE_MAP = {"a": "NO ACTION", "r": "RESTRICT", "c": "CASCADE", "n": "SET NULL", "d": "SET DEFAULT"}

UUID_PK_TABLES = (
    "agent_access",
    "agent_children",
    "agent_files",
    "agent_relatives",
    "agent_spouses",
    "agents",
    "api_traffic_logs",
    "audit_trails",
    "departments",
    "directorates",
    "error_logs",
    "otp_codes",
    "user_devices",
    "user_types",
)

USER_LOOKUP_FKS = (
    ("directorate_id", "directorates", "SET NULL"),
    ("department_id", "departments", "SET NULL"),
    ("user_type_id", "user_types", "SET NULL"),
)


def _collect_fk_columns(cursor, ref_table: str):
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
    return [
        (table, column, DELETE_MAP.get(deltype, "SET NULL"), cname, ref_table)
        for table, column, deltype, cname in cursor.fetchall()
    ]


def forwards(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        raise NotImplementedError("Integer PK migration only supports PostgreSQL")

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "UPDATE users SET directorate_id = NULL, department_id = NULL, user_type_id = NULL"
        )
        cursor.execute("UPDATE agents SET directorate_id = NULL WHERE directorate_id IS NOT NULL")

        fk_refs: list[tuple] = []
        seen: set[tuple[str, str]] = set()
        for ref_table in UUID_PK_TABLES:
            for row in _collect_fk_columns(cursor, ref_table):
                key = (row[0], row[1])
                if key not in seen:
                    seen.add(key)
                    fk_refs.append(row)

        tables_csv = ", ".join(UUID_PK_TABLES)
        cursor.execute(f"TRUNCATE TABLE {tables_csv} RESTART IDENTITY CASCADE")

        for table, column, _, cname, _ in fk_refs:
            cursor.execute(f'ALTER TABLE "{table}" DROP CONSTRAINT IF EXISTS "{cname}"')

        for table, column, _, _, _ in fk_refs:
            cursor.execute(f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE bigint USING NULL')

        for table in UUID_PK_TABLES:
            cursor.execute(f'ALTER TABLE "{table}" DROP CONSTRAINT IF EXISTS "{table}_pkey" CASCADE')
            cursor.execute(f'ALTER TABLE "{table}" DROP COLUMN IF EXISTS legacy_id')
            cursor.execute(f'ALTER TABLE "{table}" DROP COLUMN IF EXISTS id')
            cursor.execute(f'ALTER TABLE "{table}" ADD COLUMN id BIGSERIAL PRIMARY KEY')

        for table, column, on_delete, _, ref_table in fk_refs:
            cname = f"{table}_{column}_fk_{ref_table}"[:63]
            cursor.execute(
                f"""
                ALTER TABLE "{table}"
                ADD CONSTRAINT "{cname}"
                FOREIGN KEY ("{column}") REFERENCES "{ref_table}"(id) ON DELETE {on_delete}
                """
            )

        for column, ref_table, on_delete in USER_LOOKUP_FKS:
            cursor.execute(f'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_{column}_fk_{ref_table}')
            cursor.execute(f'ALTER TABLE users ALTER COLUMN "{column}" TYPE bigint USING NULL')
            cursor.execute(
                f"""
                ALTER TABLE users
                ADD CONSTRAINT users_{column}_fk_{ref_table}
                FOREIGN KEY ("{column}") REFERENCES "{ref_table}"(id) ON DELETE {on_delete}
                """
            )

        cursor.execute("ALTER TABLE people_sections DROP COLUMN IF EXISTS legacy_id")

        for table in UUID_PK_TABLES:
            cursor.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM \"{table}\"), 1), true)"
            )


def backwards(apps, schema_editor):
    raise RuntimeError("Cannot reverse integer PK migration — restore from backup if needed.")


def _big_auto():
    return models.BigAutoField(auto_created=True, primary_key=True, serialize=False)


INTEGER_PK_MODELS = [
    "usertype",
    "directorate",
    "department",
    "agent",
    "otpcode",
    "userdevice",
    "agentaccess",
    "agentrelative",
    "agentspouse",
    "agentchild",
    "agentfile",
]


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0013_users_county_integer_fk"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(forwards, backwards)],
            state_operations=[
                migrations.RemoveField(model_name="usertype", name="legacy_id"),
                migrations.RemoveField(model_name="directorate", name="legacy_id"),
                migrations.RemoveField(model_name="department", name="legacy_id"),
                migrations.RemoveField(model_name="section", name="legacy_id"),
                *[
                    migrations.AlterField(
                        model_name=name,
                        name="id",
                        field=_big_auto(),
                    )
                    for name in INTEGER_PK_MODELS
                ],
            ],
        ),
    ]
