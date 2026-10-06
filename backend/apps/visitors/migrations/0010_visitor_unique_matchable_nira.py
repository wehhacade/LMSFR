from django.db import migrations, models
import django.db.models.functions.text


class Migration(migrations.Migration):

    dependencies = [
        ("visitors", "0009_cleanup_bloated_placeholder_profiles"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="visitor",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Lower("nira"),
                condition=models.Q(
                    ("is_hidden", False),
                    models.Q(("nira", ""), _negated=True),
                    models.Q(("nira__regex", "^[0]+$"), _negated=True),
                    ("nira__regex", "^.{6,}$"),
                ),
                name="visitors_unique_matchable_nira",
            ),
        ),
    ]
