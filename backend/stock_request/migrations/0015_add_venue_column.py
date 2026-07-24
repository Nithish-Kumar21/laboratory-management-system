from django.db import migrations


def add_venue_column(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor
    with connection.cursor() as cursor:
        if vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(stock_request)")
            existing = {row[1] for row in cursor.fetchall()}
        else:
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'stock_request'"
            )
            existing = {row[0] for row in cursor.fetchall()}

        if 'venue' not in existing:
            cursor.execute(
                "ALTER TABLE stock_request ADD COLUMN venue VARCHAR(100) "
                "NULL DEFAULT 'B.Sc Chemistry Laboratory'"
            )


def remove_venue_column(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor
    with connection.cursor() as cursor:
        if vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(stock_request)")
            existing = {row[1] for row in cursor.fetchall()}
        else:
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'stock_request'"
            )
            existing = {row[0] for row in cursor.fetchall()}

        if 'venue' in existing:
            cursor.execute("ALTER TABLE stock_request DROP COLUMN venue")


class Migration(migrations.Migration):

    dependencies = [
        ('stock_request', '0014_add_stock_request_v2_fields'),
    ]

    operations = [
        migrations.RunPython(add_venue_column, remove_venue_column),
    ]
