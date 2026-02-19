# Migration to add missing stock_register_id FK columns

from django.db import migrations


def add_fk_columns(apps, schema_editor):
    """Add stock_register_id to chemical_item and apparatus_item if missing."""
    from django.db import connection
    with connection.cursor() as cursor:
        # Use database-agnostic introspection instead of SQLite PRAGMA
        table_descriptions = connection.introspection.get_table_description(cursor, 'chemical_item')
        cols = [col.name for col in table_descriptions]
        if 'stock_register_id' not in cols:
            cursor.execute(
                "ALTER TABLE chemical_item ADD COLUMN stock_register_id INTEGER REFERENCES stock_register(id)"
            )
        table_descriptions = connection.introspection.get_table_description(cursor, 'apparatus_item')
        cols = [col.name for col in table_descriptions]
        if 'stock_register_id' not in cols:
            cursor.execute(
                "ALTER TABLE apparatus_item ADD COLUMN stock_register_id INTEGER REFERENCES stock_register(id)"
            )


class Migration(migrations.Migration):

    dependencies = [
        ('stock_register', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(add_fk_columns, migrations.RunPython.noop),
    ]
