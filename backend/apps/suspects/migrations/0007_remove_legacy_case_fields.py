from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("suspects", "0006_legacy_case_damiin_structure"),
    ]

    operations = [
        migrations.AlterField(
            model_name="damiinada",
            name="code",
            field=models.CharField(blank=True, db_index=True, max_length=20, unique=True),
        ),
        migrations.AlterField(
            model_name="suspectcase",
            name="case_code",
            field=models.CharField(blank=True, db_index=True, max_length=20, unique=True),
        ),
        migrations.RemoveField(
            model_name="damiinada",
            name="amount",
        ),
        migrations.RemoveField(
            model_name="damiinada",
            name="suspect",
        ),
        migrations.RemoveField(
            model_name="suspectcase",
            name="assignee",
        ),
        migrations.RemoveField(
            model_name="suspectcase",
            name="notes",
        ),
        migrations.RemoveField(
            model_name="suspectcase",
            name="opened_at",
        ),
        migrations.RemoveField(
            model_name="suspectcase",
            name="status",
        ),
        migrations.RemoveField(
            model_name="suspectcase",
            name="title",
        ),
        migrations.AlterModelOptions(
            name="damiinada",
            options={"ordering": ["-created_at"], "verbose_name_plural": "damiinada"},
        ),
        migrations.AlterModelOptions(
            name="suspectcase",
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="suspectcase",
            index=models.Index(fields=["suspect", "-created_at"], name="suspects_su_suspect_7f0fbf_idx"),
        ),
        migrations.AddIndex(
            model_name="suspectcase",
            index=models.Index(fields=["damiin", "-created_at"], name="suspects_su_damiin__aa8f2d_idx"),
        ),
    ]
