from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("mobile", "0009_version_major_minor"),
    ]

    operations = [
        migrations.AddField(
            model_name="appversionpolicy",
            name="min_patch",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="appversionpolicy",
            name="latest_patch",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="appversionrelease",
            name="version_patch",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="appversionrelease",
            name="min_patch",
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
