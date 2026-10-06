# Generated manually for gender + Visit history

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


def forwards_seed_visits(apps, schema_editor):
    Visitor = apps.get_model("visitors", "Visitor")
    Visit = apps.get_model("visitors", "Visit")
    for v in Visitor.objects.all().iterator():
        if Visit.objects.filter(visitor_id=v.id).exists():
            continue
        Visit.objects.create(
            visitor_id=v.id,
            visiting="—",
            visited_at=v.visited_at or django.utils.timezone.now(),
            verified=bool(v.verified),
            created_by_id=v.created_by_id,
        )


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("visitors", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="visitor",
            name="gender",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="From NIRA sex field when available (m/f).",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="Visit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "visiting",
                    models.CharField(
                        help_text="Who / where they are visiting (required on new visits).",
                        max_length=500,
                    ),
                ),
                ("visited_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("verified", models.BooleanField(db_index=True, default=False)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="visitor_visits_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "visitor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="visits",
                        to="visitors.visitor",
                    ),
                ),
            ],
            options={
                "db_table": "visitor_visits",
                "ordering": ["-visited_at", "-id"],
                "indexes": [
                    models.Index(fields=["visited_at", "verified"], name="visitor_vis_visited_idx"),
                    models.Index(fields=["visitor", "visited_at"], name="visitor_vis_visitor_idx"),
                ],
            },
        ),
        migrations.RunPython(forwards_seed_visits, backwards_noop),
    ]
