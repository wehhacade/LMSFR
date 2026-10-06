from django.db import migrations, models


def seed_policy(apps, schema_editor):
    AppVersionPolicy = apps.get_model("mobile", "AppVersionPolicy")
    AppVersionPolicy.objects.update_or_create(
        pk=1,
        defaults={
            "min_version_code": 3,
            "latest_version_code": 3,
            "apk_url": "https://lmsbr.com/app/ilaalo.apk",
            "message": "Cusbooneysii app-ka",
        },
    )


def unseed_policy(apps, schema_editor):
    AppVersionPolicy = apps.get_model("mobile", "AppVersionPolicy")
    AppVersionPolicy.objects.filter(pk=1).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("mobile", "0006_suspectcar_source_suspectcar_cars_source_created_idx"),
    ]

    operations = [
        migrations.CreateModel(
            name="AppVersionPolicy",
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
                (
                    "min_version_code",
                    models.PositiveIntegerField(
                        default=3,
                        help_text="Lowest versionCode still allowed. Installed builds are 2 and send no header, so 3 locks them out.",
                    ),
                ),
                (
                    "latest_version_code",
                    models.PositiveIntegerField(
                        default=3,
                        help_text="The build that sends X-App-Version-Code and is allowed to call this backend.",
                    ),
                ),
                (
                    "apk_url",
                    models.URLField(
                        default="https://lmsbr.com/app/ilaalo.apk",
                        help_text="Fixed download address. Replace the file here before raising the minimum.",
                        max_length=500,
                    ),
                ),
                (
                    "message",
                    models.CharField(
                        default="Cusbooneysii app-ka",
                        help_text="Short text on the phone's update screen.",
                        max_length=255,
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "App version",
                "verbose_name_plural": "App version",
                "db_table": "app_version_policy",
            },
        ),
        migrations.RunPython(seed_policy, unseed_policy),
    ]
