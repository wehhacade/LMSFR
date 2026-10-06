"""Ensure personnel section departments have correct county links."""

from django.db import migrations

DEPARTMENTS = [
    ("Qeybta Galbeed", [17, 16, 133]),
    ("Qeybta Waliyow Cadde", [6, 1, 9, 7]),
]


def fix_department_links(apps, schema_editor):
    Department = apps.get_model("accounts", "Department")
    County = apps.get_model("accounts", "County")
    Agent = apps.get_model("accounts", "Agent")
    User = apps.get_model("accounts", "User")

    for dept_name, county_ids in DEPARTMENTS:
        dept, _ = Department.objects.get_or_create(name=dept_name)
        counties = County.objects.filter(pk__in=county_ids)
        if counties.exists():
            dept.counties.set(counties)

    stale = Department.objects.filter(name="Qeybta Galbeed Sare").first()
    correct = Department.objects.filter(name="Qeybta Galbeed").first()
    if stale and correct and stale.pk != correct.pk:
        has_agents = Agent.objects.filter(department_id=stale.pk).exists()
        has_users = User.objects.filter(department_id=stale.pk).exists()
        if not has_agents and not has_users:
            stale.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("personnel", "0002_seed_reference_data"),
    ]

    operations = [
        migrations.RunPython(fix_department_links, migrations.RunPython.noop),
    ]
