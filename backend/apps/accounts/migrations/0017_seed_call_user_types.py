from django.db import migrations


def seed_call_user_types(apps, schema_editor):
    UserType = apps.get_model("accounts", "UserType")
    for name, code in (
        ("taliye_degmo", "TDG"),
        ("taliye", "TAL"),
        ("xoghaye", "XOG"),
    ):
        UserType.objects.get_or_create(name=name, defaults={"code": code})


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0016_staff_payroll_model"),
    ]

    operations = [
        migrations.RunPython(seed_call_user_types, migrations.RunPython.noop),
    ]
