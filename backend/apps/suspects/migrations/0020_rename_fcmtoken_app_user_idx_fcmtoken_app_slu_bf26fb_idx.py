"""Rename FCMToken index — safe when already renamed or missing."""

from django.db import migrations, models


def rename_fcmtoken_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1 FROM pg_indexes WHERE indexname = %s
            """,
            ["fcmtoken_app_slu_bf26fb_idx"],
        )
        if cursor.fetchone():
            return
        cursor.execute(
            """
            ALTER INDEX IF EXISTS fcmtoken_app_user_idx
            RENAME TO fcmtoken_app_slu_bf26fb_idx
            """
        )
        cursor.execute(
            """
            SELECT 1 FROM pg_indexes WHERE indexname = %s
            """,
            ["fcmtoken_app_slu_bf26fb_idx"],
        )
        if cursor.fetchone():
            return
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS fcmtoken_app_slu_bf26fb_idx
            ON fcmtoken (app_slug, user_id)
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ("suspects", "0019_fcmtoken_app_slug"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RenameIndex(
                    model_name="fcmtoken",
                    new_name="fcmtoken_app_slu_bf26fb_idx",
                    old_name="fcmtoken_app_user_idx",
                ),
            ],
            database_operations=[
                migrations.RunPython(rename_fcmtoken_index, migrations.RunPython.noop),
            ],
        ),
    ]
