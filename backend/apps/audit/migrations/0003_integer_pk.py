from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("audit", "0002_alter_apitrafficlog_options_alter_audittrail_options_and_more"),
        ("accounts", "0014_all_integer_pk"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name="audittrail",
                    name="id",
                    field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False),
                ),
                migrations.AlterField(
                    model_name="errorlog",
                    name="id",
                    field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False),
                ),
                migrations.AlterField(
                    model_name="apitrafficlog",
                    name="id",
                    field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False),
                ),
            ],
        ),
    ]
