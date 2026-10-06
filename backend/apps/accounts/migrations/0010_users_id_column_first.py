"""Put users.id as the first physical column (legacy MySQL/phpMyAdmin order)."""

from django.db import migrations


def _collect_user_fk_columns(cursor):
    cursor.execute(
        """
        SELECT c.conrelid::regclass::text, a.attname, c.conname, c.confdeltype
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.confrelid = 'public.users'::regclass AND c.contype = 'f'
        ORDER BY 1, 2
        """
    )
    delete_map = {"a": "NO ACTION", "r": "RESTRICT", "c": "CASCADE", "n": "SET NULL", "d": "SET DEFAULT"}
    return [
        (table, column, conname, delete_map.get(deltype, "SET NULL"))
        for table, column, conname, deltype in cursor.fetchall()
    ]


def _drop_all_user_fks(cursor):
    cursor.execute(
        """
        SELECT c.conname, c.conrelid::regclass::text AS table_name
        FROM pg_constraint c
        WHERE c.confrelid = 'public.users'::regclass AND c.contype = 'f'
        """
    )
    for conname, table_name in cursor.fetchall():
        cursor.execute(f'ALTER TABLE {table_name} DROP CONSTRAINT "{conname}"')


def _user_columns(cursor):
    cursor.execute(
        """
        SELECT a.attname,
               pg_catalog.format_type(a.atttypid, a.atttypmod),
               a.attnotnull,
               pg_get_expr(ad.adbin, ad.adrelid)
        FROM pg_attribute a
        JOIN pg_class t ON a.attrelid = t.oid
        LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
        WHERE t.relname = 'users' AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
        """
    )
    return cursor.fetchall()


def _column_sql(name, typ, notnull, default):
    if name == "id":
        return '"id" bigint NOT NULL'
    parts = [f'"{name}"', typ]
    if notnull:
        parts.append("NOT NULL")
    if default:
        parts.append(f"DEFAULT {default}")
    return " ".join(parts)


def forwards(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP TABLE IF EXISTS users_new")
        fk_rows = _collect_user_fk_columns(cursor)
        _drop_all_user_fks(cursor)

        cols = _user_columns(cursor)
        meta = {name: (typ, notnull, default) for name, typ, notnull, default in cols}
        ordered = ["id"] + [name for name, _, _, _ in cols if name != "id"]

        create_cols = [
            _column_sql(name, *meta[name]) if name != "id" else '"id" bigint NOT NULL'
            for name in ordered
        ]
        cursor.execute(f"CREATE TABLE users_new ({', '.join(create_cols)}, PRIMARY KEY (id))")

        col_list = ", ".join(f'"{name}"' for name in ordered)
        cursor.execute(f"INSERT INTO users_new ({col_list}) SELECT {col_list} FROM users")

        cursor.execute("DROP TABLE users")
        cursor.execute("ALTER TABLE users_new RENAME TO users")

        cursor.execute("CREATE SEQUENCE IF NOT EXISTS users_id_seq OWNED BY users.id")
        cursor.execute("SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true)")
        cursor.execute("ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq'::regclass)")

        cursor.execute("CREATE UNIQUE INDEX users_username_key ON users (username)")
        cursor.execute("CREATE UNIQUE INDEX users_email_key ON users (email)")
        cursor.execute("CREATE INDEX users_email_4b85f2_idx ON users (email)")
        cursor.execute("CREATE INDEX users_is_acti_eccc90_idx ON users (is_active, suspend)")
        cursor.execute("CREATE INDEX users_date_jo_b9a773_idx ON users (date_joined DESC)")
        cursor.execute("CREATE INDEX users_username_e8658fc8_like ON users (username varchar_pattern_ops)")
        cursor.execute("CREATE INDEX users_email_0ea73cca_like ON users (email varchar_pattern_ops)")
        cursor.execute("CREATE INDEX users_county_id_60b75675 ON users (county_id)")
        cursor.execute("CREATE INDEX users_department_id_f0b302db ON users (department_id)")
        cursor.execute("CREATE INDEX users_directorate_id_0184a4a3 ON users (directorate_id)")
        cursor.execute("CREATE INDEX users_user_type_id_c594293d ON users (user_type_id)")

        for table, column, conname, on_delete in fk_rows:
            cursor.execute(
                f"""
                ALTER TABLE {table}
                ADD CONSTRAINT "{conname}"
                FOREIGN KEY ("{column}") REFERENCES users(id) ON DELETE {on_delete}
                """
            )


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0009_user_legacy_integer_pk"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
