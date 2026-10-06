from django.db import migrations


AGENT_STATUSES = [
    ("ACTIVE", "Active", "Firfircoon", True, 1),
    ("ABSENT", "Absent / Missing", "Maqan", False, 2),
    ("ABSCONDED", "Absconded / Fled", "Fakad", False, 3),
    ("INJURED", "Injured", "Dhaawac", False, 4),
    ("ARRESTED", "Arrested / Detained", "Xabsi", False, 5),
    ("TRANSFERRED", "Transferred", "Badal", False, 6),
    ("ON_LEAVE", "On Leave / Restriction", "Fasax", False, 7),
    ("RELEASED", "Released", "La sii daayay", False, 8),
]

ATTENDANCE_STATUSES = [
    ("PRESENT", "Present", "Joogey", False, 1),
    ("ABSENT", "Absent", "Maqan", True, 2),
    ("NOT_AVAILABLE", "Not Available", "Lama heli karo", False, 3),
    ("EXCUSED", "Excused", "Fasax", False, 4),
]

ABSENCE_REASONS = [
    ("INJURY", "Injury", "Dhaawac", 1),
    ("ABSCONDED", "Absconded / Fled", "Fakad", 2),
    ("MISSING", "Missing / Cannot Be Located", "Lama haayo", 3),
    ("LEAVE", "Leave / Restriction", "Fasax", 4),
    ("TRANSFERRED", "Transferred", "Badal", 5),
    ("ARRESTED", "Arrested / Detained", "Xabsi", 6),
    ("OTHER", "Other", "Kale", 7),
]

DEPARTMENTS = [
    ("Qeybta Galbeed", [17, 16, 133]),  # Wadajir, Dharkanleey, Kaxda
    ("Qeybta Waliyow Cadde", [6, 1, 9, 7]),  # Hodan, Howlwadaag, Xamarjajab, Waaberi
]


def seed_reference_data(apps, schema_editor):
    AgentStatus = apps.get_model("personnel", "AgentStatus")
    AttendanceStatus = apps.get_model("personnel", "AttendanceStatus")
    AbsenceReason = apps.get_model("personnel", "AbsenceReason")
    Department = apps.get_model("accounts", "Department")
    County = apps.get_model("accounts", "County")

    for code, name, name_so, is_active, sort_order in AGENT_STATUSES:
        AgentStatus.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "name_so": name_so,
                "is_active_state": is_active,
                "sort_order": sort_order,
                "is_system": True,
            },
        )

    for code, name, name_so, requires_reason, sort_order in ATTENDANCE_STATUSES:
        AttendanceStatus.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "name_so": name_so,
                "requires_reason": requires_reason,
                "sort_order": sort_order,
            },
        )

    for code, name, name_so, sort_order in ABSENCE_REASONS:
        AbsenceReason.objects.get_or_create(
            code=code,
            defaults={"name": name, "name_so": name_so, "sort_order": sort_order},
        )

    for dept_name, county_ids in DEPARTMENTS:
        dept, _ = Department.objects.get_or_create(name=dept_name)
        counties = County.objects.filter(pk__in=county_ids)
        if counties.exists():
            dept.counties.set(counties)


class Migration(migrations.Migration):
    dependencies = [
        ("personnel", "0001_initial"),
        ("accounts", "0019_agent_agent_status_agent_assignment_status_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_reference_data, migrations.RunPython.noop),
    ]
