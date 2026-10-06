# users.county_id was left as uuid (no DB FK constraint) — align with integer counties.id

from django.db import migrations, models
import django.db.models.deletion


def forwards(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_county_id_fk_counties")
        cursor.execute("ALTER TABLE users ALTER COLUMN county_id TYPE bigint USING NULL")
        cursor.execute(
            """
            ALTER TABLE users
            ADD CONSTRAINT users_county_id_fk_counties
            FOREIGN KEY (county_id) REFERENCES counties(id) ON DELETE SET NULL
            """
        )


def backwards(apps, schema_editor):
    raise RuntimeError("Cannot reverse users.county_id migration")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0012_location_integer_pk"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
