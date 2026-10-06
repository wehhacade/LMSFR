# Generated manually — align SuspectCase/Damiinada with legacy LMSBR structure.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


DEFAULT_STATUSES = ("Shaki", "Argagixi", "Dambiile", "La socda", "Khalad")


def seed_statuses(apps, schema_editor):
    SuspectStatus = apps.get_model("suspects", "SuspectStatus")
    for name in DEFAULT_STATUSES:
        SuspectStatus.objects.get_or_create(name=name)


def migrate_guarantors_and_cases(apps, schema_editor):
    from django.utils import timezone

    Damiinada = apps.get_model("suspects", "Damiinada")
    SuspectCase = apps.get_model("suspects", "SuspectCase")
    Suspect = apps.get_model("suspects", "Suspect")
    today = timezone.now().date()

    seq = 1
    for damiin in Damiinada.objects.all().order_by("id"):
        if not damiin.code:
            damiin.code = f"DA{seq:05d}"
            damiin.save(update_fields=["code"])
            seq += 1

        suspect_id = getattr(damiin, "suspect_id", None)
        if suspect_id and not SuspectCase.objects.filter(suspect_id=suspect_id, damiin_id=damiin.id).exists():
            suspect = Suspect.objects.filter(pk=suspect_id).first()
            SuspectCase.objects.create(
                case_code=f"SC{damiin.id:05d}",
                suspect_id=suspect_id,
                damiin_id=damiin.id,
                tuhunka_id=getattr(suspect, "suspect_type_id", None),
                capture_county_id=getattr(suspect, "capture_county_id", None),
                capture_sub_county=getattr(suspect, "capture_sub_county", "") or "",
                description=damiin.description or "",
                title=f"Case {damiin.name}",
                status="open",
                assignee="",
                opened_at=today,
                notes=damiin.description or "",
            )

    case_seq = max(SuspectCase.objects.count(), Damiinada.objects.count()) + 1
    for case in SuspectCase.objects.filter(case_code="").order_by("id"):
        legacy_notes = getattr(case, "notes", "") or ""
        legacy_title = getattr(case, "title", "") or ""
        if not case.description:
            case.description = legacy_notes or legacy_title
        case.case_code = f"SC{case_seq:05d}"
        case.save(update_fields=["case_code", "description"])
        case_seq += 1

    for case in SuspectCase.objects.exclude(case_code=""):
        if not case.description:
            legacy_notes = getattr(case, "notes", "") or ""
            if legacy_notes:
                case.description = legacy_notes
                case.save(update_fields=["description"])


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ("accounts", "0001_initial"),
        ("suspects", "0005_suspect_created_by"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SuspectStatus",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True)),
            ],
            options={
                "ordering": ["name"],
                "verbose_name_plural": "suspect statuses",
            },
        ),
        migrations.RunPython(seed_statuses, migrations.RunPython.noop),
        migrations.AddField(
            model_name="suspect",
            name="capture_county",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="captured_suspects",
                to="accounts.county",
            ),
        ),
        migrations.AddField(
            model_name="suspect",
            name="capture_sub_county",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="suspect",
            name="suspect_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="suspects",
                to="suspects.suspectstatus",
            ),
        ),
        migrations.RenameModel(
            old_name="SuspectGuarantor",
            new_name="Damiinada",
        ),
        migrations.RenameField(
            model_name="damiinada",
            old_name="full_name",
            new_name="name",
        ),
        migrations.RenameField(
            model_name="damiinada",
            old_name="notes",
            new_name="description",
        ),
        migrations.AddField(
            model_name="damiinada",
            name="code",
            field=models.CharField(blank=True, db_index=True, max_length=20),
        ),
        migrations.AddField(
            model_name="damiinada",
            name="county",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="damiinada",
                to="accounts.county",
            ),
        ),
        migrations.AddField(
            model_name="damiinada",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="registered_damiinada",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="damiinada",
            name="occupation",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="damiinada",
            name="picture_url",
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="damiinada",
            name="workplace",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="suspectcase",
            name="case_code",
            field=models.CharField(blank=True, db_index=True, max_length=20),
        ),
        migrations.AddField(
            model_name="suspectcase",
            name="capture_county",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="suspect_cases",
                to="accounts.county",
            ),
        ),
        migrations.AddField(
            model_name="suspectcase",
            name="capture_sub_county",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="suspectcase",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="registered_cases",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="suspectcase",
            name="damiin",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="cases",
                to="suspects.damiinada",
            ),
        ),
        migrations.AddField(
            model_name="suspectcase",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="suspectcase",
            name="tuhunka",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="cases",
                to="suspects.suspectstatus",
            ),
        ),
        migrations.RunPython(migrate_guarantors_and_cases, migrations.RunPython.noop),
    ]
