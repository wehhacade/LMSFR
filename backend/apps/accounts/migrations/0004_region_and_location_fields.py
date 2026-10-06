# Generated manually — Region + legacy location fields (old region/county/sub_county tables).

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_subcounty"),
    ]

    operations = [
        migrations.CreateModel(
            name="Region",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("legacy_id", models.PositiveIntegerField(blank=True, db_index=True, null=True, unique=True)),
                ("name", models.CharField(max_length=200)),
                ("code", models.CharField(blank=True, max_length=10)),
                ("description", models.TextField(blank=True)),
            ],
            options={
                "db_table": "regions",
                "ordering": ["name"],
            },
        ),
        migrations.AlterField(
            model_name="county",
            name="name",
            field=models.CharField(max_length=200),
        ),
        migrations.AddField(
            model_name="county",
            name="code",
            field=models.CharField(blank=True, max_length=10),
        ),
        migrations.AddField(
            model_name="county",
            name="description",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="county",
            name="image",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="county",
            name="legacy_id",
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="county",
            name="region",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="counties",
                to="accounts.region",
            ),
        ),
        migrations.AddField(
            model_name="subcounty",
            name="code",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="subcounty",
            name="description",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="subcounty",
            name="legacy_id",
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True, unique=True),
        ),
        migrations.AddConstraint(
            model_name="county",
            constraint=models.UniqueConstraint(fields=("region", "name"), name="uniq_county_per_region"),
        ),
    ]
