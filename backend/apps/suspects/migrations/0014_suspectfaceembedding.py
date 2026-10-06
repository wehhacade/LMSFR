# Generated manually for SuspectFaceEmbedding

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("suspects", "0013_damiin_gender_identity"),
    ]

    operations = [
        migrations.CreateModel(
            name="SuspectFaceEmbedding",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("vector", models.JSONField(default=list)),
                ("vector_hash", models.CharField(blank=True, db_index=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "suspect",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="face_embedding",
                        to="suspects.suspect",
                    ),
                ),
            ],
            options={
                "db_table": "suspectfaceembedding",
                "indexes": [models.Index(fields=["vector_hash"], name="suspectface_vector__a1b2c3_idx")],
            },
        ),
    ]
