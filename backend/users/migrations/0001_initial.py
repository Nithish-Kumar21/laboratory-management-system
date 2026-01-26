from django.db import migrations


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        # Empty - we manage tables via SQL
        # This migration exists only for Django dependency tracking
    ]
