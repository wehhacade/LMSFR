from django.db import migrations, models


def copy_installed_to_completed(apps, schema_editor):
    AgentAppInstallation = apps.get_model("mobile", "AgentAppInstallation")
    AgentAppInstallation.objects.filter(installed=True).update(status="completed")


class Migration(migrations.Migration):
    dependencies = [
        ("mobile", "0003_agent_app_installation"),
    ]

    operations = [
        migrations.AddField(
            model_name="agentappinstallation",
            name="status",
            field=models.CharField(
                choices=[
                    ("not_installed", "Looguma shubin"),
                    ("completed", "Loogu shubay"),
                    ("iphone", "iPhone"),
                ],
                db_index=True,
                default="not_installed",
                max_length=20,
            ),
        ),
        migrations.RunPython(
            copy_installed_to_completed,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
