from django.db import migrations


def add_venue_column(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor
    with connection.cursor() as cursor:
        if vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(issue_register)")
            existing = {row[1] for row in cursor.fetchall()}
        else:
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'issue_register'"
            )
            existing = {row[0] for row in cursor.fetchall()}

        if 'venue' not in existing:
            cursor.execute(
                "ALTER TABLE issue_register ADD COLUMN venue VARCHAR(100) "
                "NULL DEFAULT 'B.Sc Chemistry Laboratory'"
            )

        # Backfill venue from stock_request for existing entries
        cursor.execute(
            "UPDATE issue_register ir "
            "SET venue = sr.venue "
            "FROM stock_request sr "
            "WHERE ir.stock_request_db_id = sr.id "
            "AND (ir.venue IS NULL OR ir.venue = '')"
        )


def remove_venue_column(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor
    with connection.cursor() as cursor:
        if vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(issue_register)")
            existing = {row[1] for row in cursor.fetchall()}
        else:
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'issue_register'"
            )
            existing = {row[0] for row in cursor.fetchall()}

        if 'venue' in existing:
            cursor.execute("ALTER TABLE issue_register DROP COLUMN venue")


class Migration(migrations.Migration):

    dependencies = [
        ('stock_request', '0015_add_venue_column'),
    ]

    operations = [
        migrations.RunPython(add_venue_column, remove_venue_column),
    ]
