from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("suspects", "0014_suspectfaceembedding"),
    ]

    operations = [
        migrations.AddField(
            model_name="suspectfaceembedding",
            name="vectors",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
