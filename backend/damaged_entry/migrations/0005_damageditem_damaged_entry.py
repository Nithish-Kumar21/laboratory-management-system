from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('damaged_entry', '0004_alter_damagedentry_details'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE damaged_item ADD COLUMN damaged_entry_id INTEGER REFERENCES damaged_entry(id)",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[],
        ),
    ]
