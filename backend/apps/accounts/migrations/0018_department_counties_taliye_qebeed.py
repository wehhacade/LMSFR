from django.db import migrations, models


def seed_qeyb_galbeed(apps, schema_editor):
    UserType = apps.get_model("accounts", "UserType")
    Department = apps.get_model("accounts", "Department")
    County = apps.get_model("accounts", "County")

    UserType.objects.get_or_create(name="taliye_qebeed", defaults={"code": "TQB"})

    dept, _ = Department.objects.get_or_create(name="Qeybta Galbeed Sare")
    county_ids = list(
        County.objects.filter(pk__in=[23, 135, 136, 138]).values_list("pk", flat=True)
    )
    if county_ids:
        dept.counties.set(county_ids)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0017_seed_call_user_types"),
    ]

    operations = [
        migrations.AddField(
            model_name="department",
            name="counties",
            field=models.ManyToManyField(
                blank=True,
                related_name="departments",
                to="accounts.county",
            ),
        ),
        migrations.RunPython(seed_qeyb_galbeed, migrations.RunPython.noop),
    ]
