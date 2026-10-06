# Relationship lookup table (old Settings.Relationships).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_remove_subcounty_name_unique"),
    ]

    operations = [
        migrations.CreateModel(
            name="Relationship",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80, unique=True)),
            ],
            options={
                "db_table": "relationship",
                "ordering": ["id"],
                "verbose_name_plural": "relationships",
            },
        ),
    ]
