from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('damaged_entry', '0005_alter_damagedentry_options_alter_damageditem_options'),
    ]

    operations = [
        migrations.RunSQL(
            "ALTER TABLE damaged_entry ADD COLUMN IF NOT EXISTS day_order varchar(5) NOT NULL DEFAULT '';",
            "ALTER TABLE damaged_entry DROP COLUMN IF EXISTS day_order;"
        ),
        migrations.RunSQL(
            "ALTER TABLE damaged_entry ADD COLUMN IF NOT EXISTS hour jsonb NOT NULL DEFAULT '[]'::jsonb;",
            "ALTER TABLE damaged_entry DROP COLUMN IF EXISTS hour;"
        ),
    ]
