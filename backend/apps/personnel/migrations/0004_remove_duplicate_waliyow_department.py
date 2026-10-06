"""Remove typo duplicate 'Qeebta Waliyoow Cadde' — keep canonical 'Qeybta Waliyow Cadde'."""

from django.db import migrations

CANONICAL_WALIYOW = "Qeybta Waliyow Cadde"
TYPO_WALIYOW = "Qeebta Waliyoow Cadde"


def remove_duplicate_waliyow(apps, schema_editor):
    Department = apps.get_model("accounts", "Department")
    Agent = apps.get_model("accounts", "Agent")
    User = apps.get_model("accounts", "User")

    canonical = Department.objects.filter(name=CANONICAL_WALIYOW).first()
    typo = Department.objects.filter(name=TYPO_WALIYOW).first()
    if not typo:
        return

    if canonical and typo.pk != canonical.pk:
        Agent.objects.filter(department_id=typo.pk).update(department_id=canonical.pk)
        User.objects.filter(department_id=typo.pk).update(department_id=canonical.pk)
        typo.delete()
    elif not canonical:
        typo.name = CANONICAL_WALIYOW
        typo.save(update_fields=["name"])


class Migration(migrations.Migration):
    dependencies = [
        ("personnel", "0003_fix_department_links"),
    ]

    operations = [
        migrations.RunPython(remove_duplicate_waliyow, migrations.RunPython.noop),
    ]
