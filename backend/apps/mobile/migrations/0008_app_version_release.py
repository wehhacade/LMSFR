from django.db import migrations, models


def seed_current_release(apps, schema_editor):
    AppVersionPolicy = apps.get_model("mobile", "AppVersionPolicy")
    AppVersionRelease = apps.get_model("mobile", "AppVersionRelease")
    policy = AppVersionPolicy.objects.filter(pk=1).first()
    if policy is None or AppVersionRelease.objects.exists():
        return
    AppVersionRelease.objects.create(
        version_code=policy.latest_version_code,
        min_version_code=policy.min_version_code,
        apk_url=policy.apk_url,
        message=policy.message,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("mobile", "0007_app_version_policy"),
    ]

    operations = [
        migrations.CreateModel(
            name="AppVersionRelease",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("version_code", models.PositiveIntegerField(db_index=True)),
                ("min_version_code", models.PositiveIntegerField()),
                ("apk_url", models.URLField(max_length=500)),
                ("message", models.CharField(max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "App release",
                "verbose_name_plural": "App releases",
                "db_table": "app_version_releases",
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.RunPython(seed_current_release, migrations.RunPython.noop),
    ]
