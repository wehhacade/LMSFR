"""Tag FCM tokens by mobile app so Ilaalo Shacab and Survey pushes stay separate."""

from django.db import migrations, models


def backfill_app_slug(apps, schema_editor):
    FCMToken = apps.get_model("suspects", "FCMToken")
    User = apps.get_model("accounts", "User")
    UserType = apps.get_model("accounts", "UserType")

    FCMToken.objects.all().update(app_slug="ilaalo")

    survey_type_ids = list(
        UserType.objects.filter(name__iexact="survey-mobile").values_list("id", flat=True)
    )
    if not survey_type_ids:
        return

    survey_only_user_ids = list(
        User.objects.filter(user_type_id__in=survey_type_ids, is_agent=False).values_list("id", flat=True)
    )
    if survey_only_user_ids:
        FCMToken.objects.filter(user_id__in=survey_only_user_ids).update(app_slug="survey")


class Migration(migrations.Migration):

    dependencies = [
        ("suspects", "0018_recount_suspect_captures"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="fcmtoken",
            name="app_slug",
            field=models.CharField(
                choices=[("ilaalo", "Ilaalo Shacab"), ("survey", "Survey mobile")],
                db_index=True,
                default="ilaalo",
                max_length=20,
            ),
        ),
        migrations.RunPython(backfill_app_slug, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name="fcmtoken",
            index=models.Index(fields=["app_slug", "user"], name="fcmtoken_app_user_idx"),
        ),
    ]
