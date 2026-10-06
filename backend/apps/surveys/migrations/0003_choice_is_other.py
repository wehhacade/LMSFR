from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("surveys", "0002_add_response_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="choice",
            name="is_other",
            field=models.BooleanField(default=False),
        ),
    ]
