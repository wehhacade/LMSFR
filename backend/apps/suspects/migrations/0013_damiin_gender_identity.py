from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("suspects", "0012_legacy_table_names"),
    ]

    operations = [
        migrations.AddField(
            model_name="damiinada",
            name="gender",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="damiinada",
            name="identity_picture_url",
            field=models.URLField(blank=True, max_length=500),
        ),
    ]
