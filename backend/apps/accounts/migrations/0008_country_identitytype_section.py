# Country, IdentityType, Section (laamaha) — old Settings tables.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_relationship_field_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="Country",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True)),
            ],
            options={"db_table": "countries", "ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="IdentityType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True)),
            ],
            options={"db_table": "identity_types", "ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Section",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("legacy_id", models.PositiveIntegerField(blank=True, db_index=True, null=True, unique=True)),
                ("name", models.CharField(max_length=200)),
                ("code", models.CharField(blank=True, max_length=100)),
                (
                    "sub_county",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sections",
                        to="accounts.subcounty",
                    ),
                ),
            ],
            options={"db_table": "people_sections", "ordering": ["name"]},
        ),
    ]
