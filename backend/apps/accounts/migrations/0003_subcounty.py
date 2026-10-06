# Generated manually

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_agentaccess_agentchild_agentfile_agentrelative_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="SubCounty",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=200)),
                (
                    "county",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sub_counties",
                        to="accounts.county",
                    ),
                ),
            ],
            options={
                "db_table": "sub_counties",
                "ordering": ["name"],
            },
        ),
        migrations.AddConstraint(
            model_name="subcounty",
            constraint=models.UniqueConstraint(fields=("county", "name"), name="uniq_sub_county_per_county"),
        ),
    ]
