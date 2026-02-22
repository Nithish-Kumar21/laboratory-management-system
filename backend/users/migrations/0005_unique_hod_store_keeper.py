# One HOD and one Store Keeper only - database-level constraint

from django.db import migrations


def add_unique_role_constraints(apps, schema_editor):
    """Add partial unique indexes so only one active HOD and one store_keeper can exist."""
    from django.db import connection
    with connection.cursor() as cursor:
        # PostgreSQL partial unique index: only one row with role='hod'
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS user_account_one_hod
            ON user_account (role) WHERE role = 'hod';
        """)
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS user_account_one_store_keeper
            ON user_account (role) WHERE role = 'store_keeper';
        """)


def remove_unique_role_constraints(apps, schema_editor):
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("DROP INDEX IF EXISTS user_account_one_hod;")
        cursor.execute("DROP INDEX IF EXISTS user_account_one_store_keeper;")


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_alter_passwordresettoken_options_alter_user_options'),
    ]

    operations = [
        migrations.RunPython(add_unique_role_constraints, remove_unique_role_constraints),
    ]
