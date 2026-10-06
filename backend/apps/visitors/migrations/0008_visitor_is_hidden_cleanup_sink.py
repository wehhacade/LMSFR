from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("visitors", "0007_fix_placeholder_nira_merges"),
    ]

    operations = [
        migrations.AddField(
            model_name="visitor",
            name="is_hidden",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text="System sink / unassigned rows — excluded from staff list and profiles.",
            ),
        ),
        migrations.AddIndex(
            model_name="visitor",
            index=models.Index(fields=["is_hidden", "visited_at"], name="visitors_is_hidden_visited_idx"),
        ),
    ]
