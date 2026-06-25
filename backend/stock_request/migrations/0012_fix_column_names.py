from django.db import migrations, models


def safe_alter_issue_register(apps, schema_editor):
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

        if 'date' not in existing:
            cursor.execute("ALTER TABLE issue_register ADD COLUMN date DATE NULL")
        if 'status' not in existing:
            cursor.execute("ALTER TABLE issue_register ADD COLUMN status VARCHAR(20) NULL")
        if 'class_name' in existing and 'class' not in existing:
            if vendor == 'sqlite':
                cursor.execute("ALTER TABLE issue_register RENAME COLUMN class_name TO class")
            else:
                cursor.execute('ALTER TABLE issue_register RENAME COLUMN "class_name" TO "class"')
        if 'id' in existing and 'ir_id' not in existing:
            if vendor == 'sqlite':
                cursor.execute("ALTER TABLE issue_register RENAME COLUMN id TO ir_id")
            else:
                cursor.execute('ALTER TABLE issue_register RENAME COLUMN "id" TO "ir_id"')
        if 'request_id' in existing:
            cursor.execute("ALTER TABLE issue_register DROP COLUMN request_id")
        if 'issued_at' in existing:
            cursor.execute("ALTER TABLE issue_register DROP COLUMN issued_at")
        if 'completed_at' in existing:
            cursor.execute("ALTER TABLE issue_register DROP COLUMN completed_at")
        if 'created_at' in existing:
            cursor.execute("ALTER TABLE issue_register DROP COLUMN created_at")


def safe_create_issue_chemicals(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor
    with connection.cursor() as cursor:
        if vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(issue_chemicals)")
            existing = {row[1] for row in cursor.fetchall()}
        else:
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'issue_chemicals'"
            )
            existing = {row[0] for row in cursor.fetchall()}

        if existing:
            if 'unit' not in existing:
                cursor.execute(
                    "ALTER TABLE issue_chemicals ADD COLUMN unit "
                    "VARCHAR(2) NOT NULL DEFAULT 'ml'"
                )
            if 'returned' not in existing:
                cursor.execute(
                    "ALTER TABLE issue_chemicals ADD COLUMN returned DECIMAL(10,2) NULL"
                )
            if 'additional' not in existing:
                cursor.execute(
                    "ALTER TABLE issue_chemicals ADD COLUMN additional DECIMAL(10,2) NULL"
                )
        else:
            if vendor == 'sqlite':
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS issue_chemicals (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ir_id INTEGER NOT NULL REFERENCES issue_register(ir_id),
                        chemical_name VARCHAR(64) NOT NULL,
                        issued_quantity DECIMAL(10,2) NOT NULL,
                        unit VARCHAR(2) NOT NULL DEFAULT 'ml',
                        actual_usage DECIMAL(10,2) NULL,
                        returned DECIMAL(10,2) NULL,
                        additional DECIMAL(10,2) NULL
                    )
                """)
            else:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS issue_chemicals (
                        id SERIAL PRIMARY KEY,
                        ir_id INTEGER NOT NULL REFERENCES issue_register(ir_id),
                        chemical_name VARCHAR(64) NOT NULL,
                        issued_quantity DECIMAL(10,2) NOT NULL,
                        unit VARCHAR(2) NOT NULL DEFAULT 'ml',
                        actual_usage DECIMAL(10,2) NULL,
                        returned DECIMAL(10,2) NULL,
                        additional DECIMAL(10,2) NULL
                    )
                """)


class Migration(migrations.Migration):

    dependencies = [
        ('stock_request', '0011_alter_stockrequest_rejection_reason_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='stockrequestchemicalitem',
            old_name='quantity_ml',
            new_name='quantity',
        ),
        migrations.AddField(
            model_name='stockrequestchemicalitem',
            name='unit',
            field=models.CharField(
                choices=[('ml', 'mL'), ('g', 'g')],
                default='ml', max_length=2,
            ),
        ),
        migrations.RenameField(
            model_name='stockrequestchemicalitem',
            old_name='actual_used_quantity_ml',
            new_name='actual_used_quantity',
        ),
        migrations.RunPython(
            safe_alter_issue_register,
            migrations.RunPython.noop,
        ),
        migrations.RunPython(
            safe_create_issue_chemicals,
            migrations.RunPython.noop,
        ),
    ]
