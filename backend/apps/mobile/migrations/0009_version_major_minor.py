from django.db import migrations, models


def _split(code):
    code = int(code or 0)
    if code >= 100:
        return code // 100, code % 100
    return code, 0


def backfill_major_minor(apps, schema_editor):
    AppVersionPolicy = apps.get_model("mobile", "AppVersionPolicy")
    AppVersionRelease = apps.get_model("mobile", "AppVersionRelease")
    for policy in AppVersionPolicy.objects.all():
        policy.min_major, policy.min_minor = _split(policy.min_version_code)
        policy.latest_major, policy.latest_minor = _split(policy.latest_version_code)
        policy.save(update_fields=["min_major", "min_minor", "latest_major", "latest_minor"])
    for release in AppVersionRelease.objects.all():
        release.version_major, release.version_minor = _split(release.version_code)
        release.min_major, release.min_minor = _split(release.min_version_code)
        release.save(update_fields=["version_major", "version_minor", "min_major", "min_minor"])


class Migration(migrations.Migration):

    dependencies = [
        ("mobile", "0008_app_version_release"),
    ]

    operations = [
        migrations.AddField(
            model_name="appversionpolicy",
            name="min_major",
            field=models.PositiveIntegerField(default=3),
        ),
        migrations.AddField(
            model_name="appversionpolicy",
            name="min_minor",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="appversionpolicy",
            name="latest_major",
            field=models.PositiveIntegerField(default=3),
        ),
        migrations.AddField(
            model_name="appversionpolicy",
            name="latest_minor",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="appversionrelease",
            name="version_major",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="appversionrelease",
            name="version_minor",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="appversionrelease",
            name="min_major",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="appversionrelease",
            name="min_minor",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.RunPython(backfill_major_minor, migrations.RunPython.noop),
    ]
