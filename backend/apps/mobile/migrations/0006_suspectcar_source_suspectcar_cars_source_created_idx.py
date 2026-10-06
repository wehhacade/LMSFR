"""Add SuspectCar.source — safe when column/index already exist in DB."""

from django.db import migrations, models


def ensure_source_column(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'cars' AND column_name = 'source'
            """
        )
        if cursor.fetchone():
            return
        cursor.execute(
            """
            ALTER TABLE cars
            ADD COLUMN source varchar(20) NOT NULL DEFAULT 'amniga'
            """
        )


def ensure_source_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS cars_source_created_idx
            ON cars (source, created_at DESC)
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ("mobile", "0005_agent_app_installation_reason"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="suspectcar",
                    name="source",
                    field=models.CharField(
                        choices=[("amniga", "Amniga"), ("baaris", "Baaris")],
                        db_index=True,
                        default="amniga",
                        max_length=20,
                    ),
                ),
                migrations.AddIndex(
                    model_name="suspectcar",
                    index=models.Index(
                        fields=["source", "-created_at"],
                        name="cars_source_created_idx",
                    ),
                ),
            ],
            database_operations=[
                migrations.RunPython(ensure_source_column, migrations.RunPython.noop),
                migrations.RunPython(ensure_source_index, migrations.RunPython.noop),
            ],
        ),
    ]
