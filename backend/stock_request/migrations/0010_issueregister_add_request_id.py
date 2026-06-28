from django.db import migrations


def _resolve_table_name(cursor, vendor, candidates):
    if vendor == 'sqlite':
        for name in candidates:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name])
            if cursor.fetchone():
                return name
        return None
    else:
        placeholders = ','.join("'" + n + "'" for n in candidates)
        cursor.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name IN (" + placeholders + ")"
        )
        row = cursor.fetchone()
        return row[0] if row else None


def _get_columns(cursor, vendor, tbl):
    if vendor == 'sqlite':
        cursor.execute("PRAGMA table_info(" + tbl + ")")
        return {row[1] for row in cursor.fetchall()}
    else:
        cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = %s", [tbl]
        )
        return {row[0] for row in cursor.fetchall()}


def safe_add_request_columns(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor
    candidates = ['issue_register', 'chemical_issue_register']
    with connection.cursor() as cursor:
        tbl = _resolve_table_name(cursor, vendor, candidates)
        if tbl is None:
            return
        existing = _get_columns(cursor, vendor, tbl)
        if 'request_code' not in existing:
            cursor.execute("ALTER TABLE " + tbl + " ADD COLUMN request_code VARCHAR(20) NULL DEFAULT NULL")
        if 'stock_request_db_id' not in existing:
            cursor.execute("ALTER TABLE " + tbl + " ADD COLUMN stock_request_db_id INTEGER NULL DEFAULT NULL")


def safe_drop_request_columns(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor
    candidates = ['issue_register', 'chemical_issue_register']
    with connection.cursor() as cursor:
        tbl = _resolve_table_name(cursor, vendor, candidates)
        if tbl is None:
            return
        if vendor == 'sqlite':
            cursor.execute("ALTER TABLE " + tbl + " DROP COLUMN request_code")
            cursor.execute("ALTER TABLE " + tbl + " DROP COLUMN stock_request_db_id")
        else:
            cursor.execute('ALTER TABLE ' + tbl + ' DROP COLUMN IF EXISTS request_code')
            cursor.execute('ALTER TABLE ' + tbl + ' DROP COLUMN IF EXISTS stock_request_db_id')


class Migration(migrations.Migration):

    dependencies = [
        ('stock_request', '0009_stockrequest_date_default_rejection_reason'),
    ]

    operations = [
        migrations.RunPython(
            safe_add_request_columns,
            safe_drop_request_columns,
        ),
    ]
