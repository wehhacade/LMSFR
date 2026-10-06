# Align Relationship field name with old project (relationship, not name).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_relationship"),
    ]

    operations = [
        migrations.RenameField(
            model_name="relationship",
            old_name="name",
            new_name="relationship",
        ),
        migrations.AlterField(
            model_name="relationship",
            name="relationship",
            field=models.CharField(max_length=50, unique=True),
        ),
    ]
