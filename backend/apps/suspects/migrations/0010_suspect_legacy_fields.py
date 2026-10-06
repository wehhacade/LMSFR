# Full legacy Suspects fields (old Suspects model parity).

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_country_identitytype_section"),
        ("suspects", "0009_damiin_relationship_fk"),
    ]

    operations = [
        migrations.AddField(
            model_name="suspect",
            name="mother_name",
            field=models.CharField(blank=True, db_index=True, max_length=100),
        ),
        migrations.AddField(
            model_name="suspect",
            name="date_of_birth",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="suspect",
            name="goobta_dhalashada",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="suspect",
            name="address",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="address_suspects",
                to="accounts.county",
            ),
        ),
        migrations.AddField(
            model_name="suspect",
            name="phone",
            field=models.CharField(blank=True, db_index=True, max_length=20),
        ),
        migrations.AddField(
            model_name="suspect",
            name="marriage_status",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="suspect",
            name="children",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="suspect",
            name="xabsi_waligaa_ma_soo_martay",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="suspect",
            name="tribe",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="suspect",
            name="occupation",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="suspect",
            name="lambarka_diiwaanka",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="suspect",
            name="is_released",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="suspect",
            name="bail_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="suspect",
            name="father_contact",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="suspect",
            name="mother_contact",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="suspect",
            name="date_opp",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="suspect",
            name="day",
            field=models.CharField(blank=True, max_length=10),
        ),
        migrations.AddField(
            model_name="suspect",
            name="month",
            field=models.CharField(blank=True, max_length=10),
        ),
        migrations.AddField(
            model_name="suspect",
            name="year",
            field=models.CharField(blank=True, max_length=10),
        ),
        migrations.AddField(
            model_name="suspect",
            name="latitude",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="suspect",
            name="longitude",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="suspect",
            name="nationality",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="suspects",
                to="accounts.country",
            ),
        ),
        migrations.AddField(
            model_name="suspect",
            name="gender",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="suspect",
            name="goobta_shaqada",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="suspect",
            name="suspect_identifier",
            field=models.CharField(blank=True, max_length=300),
        ),
    ]
