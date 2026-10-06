# Damiinada.new_relationship FK — old new_relationship field.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_relationship"),
        ("suspects", "0008_subcounty_fks"),
    ]

    operations = [
        migrations.AddField(
            model_name="damiinada",
            name="new_relationship",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="damiinada",
                to="accounts.relationship",
            ),
        ),
    ]
