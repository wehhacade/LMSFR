from django.db import migrations, models
import django.db.models.deletion


ALLEGATIONS = (
    "Argagixisanimo",
    "Dhac hubaysan",
    "Dil",
)


def seed_allegations(apps, schema_editor):
    VisitAllegation = apps.get_model("visitors", "VisitAllegation")
    for order, name in enumerate(ALLEGATIONS, start=1):
        VisitAllegation.objects.get_or_create(
            name=name,
            defaults={"sort_order": order, "is_active": True},
        )


def unseed_allegations(apps, schema_editor):
    VisitAllegation = apps.get_model("visitors", "VisitAllegation")
    VisitAllegation.objects.filter(name__in=ALLEGATIONS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("visitors", "0004_visit_contact_details"),
    ]

    operations = [
        migrations.CreateModel(
            name="VisitAllegation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200, unique=True)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "visit allegation",
                "verbose_name_plural": "visit allegations",
                "db_table": "visitor_allegations",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.AddField(
            model_name="visit",
            name="allegation",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="visits",
                to="visitors.visitallegation",
            ),
        ),
        migrations.AddField(
            model_name="visit",
            name="sentence",
            field=models.TextField(blank=True, help_text="Sentence or judgment imposed."),
        ),
        migrations.RunPython(seed_allegations, unseed_allegations),
    ]
