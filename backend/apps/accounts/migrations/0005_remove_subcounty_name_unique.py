# Remove sub_county (county, name) unique — production has duplicate names per county.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_region_and_location_fields"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="subcounty",
            name="uniq_sub_county_per_county",
        ),
    ]
