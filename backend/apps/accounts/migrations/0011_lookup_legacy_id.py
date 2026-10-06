from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_users_id_column_first"),
    ]

    operations = [
        migrations.AddField(
            model_name="directorate",
            name="legacy_id",
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="department",
            name="legacy_id",
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="usertype",
            name="legacy_id",
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True, unique=True),
        ),
    ]
