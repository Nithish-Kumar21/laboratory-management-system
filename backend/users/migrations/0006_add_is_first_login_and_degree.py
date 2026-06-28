from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0005_unique_hod_store_keeper'),
    ]

    operations = [
        migrations.RunSQL(
            "ALTER TABLE user_account ADD COLUMN IF NOT EXISTS degree varchar(50) NULL",
            "ALTER TABLE user_account DROP COLUMN IF EXISTS degree",
        ),
        migrations.RunSQL(
            "ALTER TABLE user_account ADD COLUMN IF NOT EXISTS is_first_login boolean NOT NULL DEFAULT false",
            "ALTER TABLE user_account DROP COLUMN IF EXISTS is_first_login",
        ),
    ]
