from django.db import migrations, models


DESTINATIONS = (
    "Maxkamadda Ciidanka QS.",
    "Maxkamadda sare.",
    "Xeer ilaalinta Guud Qaranka.",
    "Maxkamadda Rafcaanka GB.",
    "Maxkamadda G/banaadir.",
)


def seed_destinations(apps, schema_editor):
    VisitDestination = apps.get_model("visitors", "VisitDestination")
    for order, name in enumerate(DESTINATIONS, start=1):
        VisitDestination.objects.get_or_create(
            name=name,
            defaults={"sort_order": order, "is_active": True},
        )


def unseed_destinations(apps, schema_editor):
    VisitDestination = apps.get_model("visitors", "VisitDestination")
    VisitDestination.objects.filter(name__in=DESTINATIONS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("visitors", "0002_visitor_gender_visit"),
    ]

    operations = [
        migrations.CreateModel(
            name="VisitDestination",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200, unique=True)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "visit destination",
                "verbose_name_plural": "visit destinations",
                "db_table": "visitor_destinations",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.RunPython(seed_destinations, unseed_destinations),
    ]
