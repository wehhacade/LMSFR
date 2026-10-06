from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("mobile", "0004_agent_app_installation_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="agentappinstallation",
            name="not_installed_reason",
            field=models.CharField(
                blank=True,
                choices=[
                    ("did_not_attend", "Ma imaanin"),
                    ("basic_phone", "Telefoon button/Nokia wata"),
                    ("no_phone", "Mobile ma wato"),
                    ("unsupported_phone", "Mobile-ku ma taageerayo"),
                    ("no_internet", "Internet/xog ma leh"),
                    ("login_issue", "Password/login cilad"),
                    ("refused", "Wuu diiday"),
                    ("other", "Sabab kale"),
                ],
                db_index=True,
                default="",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="agentappinstallation",
            name="not_installed_reason_detail",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
