from django.db import migrations


DESTINATION = "Xabsiga Dhexe Ee Xamar"
SORT_ORDER = 6


def seed_destination(apps, schema_editor):
    VisitDestination = apps.get_model("visitors", "VisitDestination")
    VisitDestination.objects.get_or_create(
        name=DESTINATION,
        defaults={"sort_order": SORT_ORDER, "is_active": True},
    )


def unseed_destination(apps, schema_editor):
    VisitDestination = apps.get_model("visitors", "VisitDestination")
    VisitDestination.objects.filter(name=DESTINATION).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("visitors", "0005_visitallegation_visit_allegation_visit_sentence"),
    ]

    operations = [
        migrations.RunPython(seed_destination, unseed_destination),
    ]
