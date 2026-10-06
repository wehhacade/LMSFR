from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("mobile", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE wanted
                            ADD COLUMN IF NOT EXISTS mother_name varchar(100) NOT NULL DEFAULT '',
                            ADD COLUMN IF NOT EXISTS phone varchar(20) NOT NULL DEFAULT '',
                            ADD COLUMN IF NOT EXISTS created_by_id bigint NULL;
                        ALTER TABLE wanted ALTER COLUMN mother_name DROP DEFAULT;
                        ALTER TABLE wanted ALTER COLUMN phone DROP DEFAULT;
                        CREATE INDEX IF NOT EXISTS wanted_phone_idx ON wanted (phone);
                        CREATE INDEX IF NOT EXISTS wanted_created_by_idx ON wanted (created_by_id);
                    """,
                    reverse_sql="""
                        DROP INDEX IF EXISTS wanted_created_by_idx;
                        DROP INDEX IF EXISTS wanted_phone_idx;
                        ALTER TABLE wanted
                            DROP COLUMN IF EXISTS created_by_id,
                            DROP COLUMN IF EXISTS phone,
                            DROP COLUMN IF EXISTS mother_name;
                    """,
                )
            ],
            state_operations=[
                migrations.AddField(
                    model_name="wantedperson",
                    name="mother_name",
                    field=models.CharField(blank=True, default="", max_length=100),
                    preserve_default=False,
                ),
                migrations.AddField(
                    model_name="wantedperson",
                    name="phone",
                    field=models.CharField(blank=True, db_index=True, default="", max_length=20),
                    preserve_default=False,
                ),
                migrations.AddField(
                    model_name="wantedperson",
                    name="created_by",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="wanted_persons_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        )
    ]
