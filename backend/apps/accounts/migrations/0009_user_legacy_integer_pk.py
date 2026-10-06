# Convert users.id UUID → bigint (legacy MySQL import). Wipes user-linked rows first.

from django.db import migrations, models


def _collect_user_fk_columns(cursor):
    cursor.execute(
        """
        SELECT c.conrelid::regclass::text, a.attname, c.confdeltype
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.confrelid = 'users'::regclass AND c.contype = 'f'
        ORDER BY 1, 2
        """
    )
    # confdeltype: a=no action, r=restrict, c=cascade, n=set null, d=set default
    delete_map = {"a": "NO ACTION", "r": "RESTRICT", "c": "CASCADE", "n": "SET NULL", "d": "SET DEFAULT"}
    rows = []
    for table, column, deltype in cursor.fetchall():
        rows.append((table, column, delete_map.get(deltype, "SET NULL")))
    return rows


def forwards(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        raise NotImplementedError("User PK migration only supports PostgreSQL")

    with schema_editor.connection.cursor() as cursor:
        fk_columns = _collect_user_fk_columns(cursor)
        cursor.execute("TRUNCATE TABLE users CASCADE")
        cursor.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey CASCADE")

        for table, column, _ in fk_columns:
            cursor.execute(f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE bigint USING NULL')

        cursor.execute("ALTER TABLE users DROP COLUMN IF EXISTS id")
        cursor.execute("ALTER TABLE users ADD COLUMN id BIGSERIAL PRIMARY KEY")

        for table, column, on_delete in fk_columns:
            constraint = f"{table}_{column}_fk_users"
            cursor.execute(
                f"""
                ALTER TABLE "{table}"
                ADD CONSTRAINT "{constraint}"
                FOREIGN KEY ("{column}") REFERENCES users(id) ON DELETE {on_delete}
                """
            )

        cursor.execute("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), true)")


def backwards(apps, schema_editor):
    raise RuntimeError("Cannot reverse user PK migration — restore from backup if needed.")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_country_identitytype_section"),
        ("suspects", "0012_legacy_table_names"),
        ("audit", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(forwards, backwards),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name="user",
                    name="id",
                    field=models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
            ],
        ),
    ]
