# Generated manually — SubCounty FKs like old project (deg_Damiinada, w_qabashada).

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_subcounty"),
        ("suspects", "0007_remove_legacy_case_fields"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="suspect",
            name="capture_sub_county",
        ),
        migrations.RemoveField(
            model_name="suspectcase",
            name="capture_sub_county",
        ),
        migrations.AddField(
            model_name="damiinada",
            name="sub_county",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="damiinada",
                to="accounts.subcounty",
            ),
        ),
        migrations.AddField(
            model_name="suspect",
            name="capture_sub_county",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="captured_suspects",
                to="accounts.subcounty",
            ),
        ),
        migrations.AddField(
            model_name="suspectcase",
            name="capture_sub_county",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="suspect_cases",
                to="accounts.subcounty",
            ),
        ),
    ]
