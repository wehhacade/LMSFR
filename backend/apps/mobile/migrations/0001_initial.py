from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("accounts", "0015_alter_agent_id_alter_agentaccess_id_and_more"),
        ("suspects", "0012_legacy_table_names"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AppDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tobic", models.CharField(blank=True, max_length=100)),
                ("body", models.TextField()),
                ("tag", models.CharField(db_index=True, max_length=50)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("modified_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "appdocument",
                "ordering": ["id"],
            },
        ),
        migrations.CreateModel(
            name="CabashadaAppka",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(blank=True, max_length=100)),
                ("description", models.TextField(blank=True)),
                ("is_seen", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("modified_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="cabasho_entries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "cabashadaappka",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="MobileTask",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField()),
                ("is_seen", models.BooleanField(default=False)),
                ("picture", models.ImageField(blank=True, null=True, upload_to="warbixinada_images/")),
                ("date_opp", models.DateField(blank=True, null=True)),
                ("day", models.CharField(blank=True, max_length=10)),
                ("month", models.CharField(blank=True, max_length=10)),
                ("year", models.CharField(blank=True, max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("modified_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="mobile_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "task",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="SuspectCarModal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(blank=True, max_length=100, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("modified_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "suspectcarmodal",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="WantedType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
            ],
            options={
                "db_table": "wantedtype",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="WantedPerson",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(db_index=True, max_length=200)),
                ("gender", models.CharField(blank=True, max_length=20)),
                ("wanted_status", models.CharField(blank=True, max_length=50)),
                ("priority", models.CharField(blank=True, max_length=50)),
                ("details", models.TextField(blank=True)),
                ("photo", models.ImageField(blank=True, null=True, upload_to="wanted_images/")),
                ("date_recorded", models.DateTimeField(auto_now_add=True)),
                (
                    "citizenship",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="accounts.country",
                    ),
                ),
                (
                    "wanted_type",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="mobile.wantedtype",
                    ),
                ),
            ],
            options={
                "db_table": "wanted",
                "ordering": ["-date_recorded"],
            },
        ),
        migrations.CreateModel(
            name="UserLocation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("latitude", models.FloatField(blank=True, null=True)),
                ("longitude", models.FloatField(blank=True, null=True)),
                ("last_updated", models.DateTimeField(auto_now=True)),
                ("reg_day", models.CharField(blank=True, max_length=10)),
                ("year", models.CharField(blank=True, max_length=10)),
                ("month", models.CharField(blank=True, max_length=10)),
                (
                    "suspect",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="location_history",
                        to="suspects.suspect",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="location_history",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "user_location",
            },
        ),
        migrations.CreateModel(
            name="UserSuspectTag",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tag", models.CharField(default="new", max_length=10)),
                ("click_count", models.PositiveIntegerField(default=0)),
                (
                    "suspect",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="suspects.suspect"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "db_table": "usersuspecttag",
            },
        ),
        migrations.CreateModel(
            name="SuspectCar",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("plate_number", models.CharField(blank=True, max_length=50)),
                ("old_car_model", models.CharField(blank=True, max_length=50)),
                ("latitude", models.CharField(blank=True, max_length=20)),
                ("longitude", models.CharField(blank=True, max_length=20)),
                ("description", models.TextField(blank=True)),
                ("ownership", models.CharField(blank=True, max_length=20)),
                ("ownername", models.CharField(blank=True, max_length=100)),
                ("ownerphone", models.CharField(blank=True, max_length=30)),
                ("picture", models.FileField(blank=True, null=True, upload_to="car_pictures/")),
                ("date_opp", models.DateField(blank=True, null=True)),
                ("day", models.CharField(blank=True, max_length=10)),
                ("month", models.CharField(blank=True, max_length=10)),
                ("year", models.CharField(blank=True, max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("modified_at", models.DateTimeField(auto_now=True)),
                (
                    "car_model",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="cars",
                        to="mobile.suspectcarmodal",
                    ),
                ),
                (
                    "recorded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recorded_cars",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "suspect",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="suspects.suspect",
                    ),
                ),
            ],
            options={
                "db_table": "cars",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="mobiletask",
            index=models.Index(fields=["-created_at"], name="task_created_desc_idx"),
        ),
        migrations.AddIndex(
            model_name="mobiletask",
            index=models.Index(fields=["user", "-created_at"], name="task_user_created_idx"),
        ),
        migrations.AddIndex(
            model_name="userlocation",
            index=models.Index(fields=["user", "-last_updated"], name="uloc_user_updated_idx"),
        ),
        migrations.AddIndex(
            model_name="usersuspecttag",
            index=models.Index(fields=["user", "suspect"], name="ustag_user_suspect_idx"),
        ),
        migrations.AlterUniqueTogether(
            name="usersuspecttag",
            unique_together={("user", "suspect")},
        ),
        migrations.AddIndex(
            model_name="suspectcar",
            index=models.Index(fields=["-created_at"], name="cars_created_desc_idx"),
        ),
        migrations.AddIndex(
            model_name="suspectcar",
            index=models.Index(fields=["plate_number"], name="cars_plate_idx"),
        ),
    ]
