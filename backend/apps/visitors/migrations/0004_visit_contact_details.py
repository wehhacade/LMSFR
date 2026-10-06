from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("visitors", "0003_visitdestination"),
    ]

    operations = [
        migrations.AddField(
            model_name="visit",
            name="contact_name",
            field=models.CharField(
                blank=True,
                help_text="Three-part name of the person being visited.",
                max_length=500,
            ),
        ),
        migrations.AddField(
            model_name="visit",
            name="relationship",
            field=models.CharField(
                blank=True,
                help_text="Visitor's relationship to the person being visited.",
                max_length=200,
            ),
        ),
    ]
