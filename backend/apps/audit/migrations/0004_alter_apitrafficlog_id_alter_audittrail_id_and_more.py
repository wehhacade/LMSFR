# Sync Django migration state (integer PK + verbose_name). DB already converted in 0014.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("audit", "0003_integer_pk"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name="apitrafficlog",
                    name="id",
                    field=models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                migrations.AlterField(
                    model_name="audittrail",
                    name="id",
                    field=models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                migrations.AlterField(
                    model_name="errorlog",
                    name="id",
                    field=models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
            ],
        ),
    ]
