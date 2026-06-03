import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
with connection.cursor() as cursor:
    for table in ['stock_register', 'chemical_item', 'apparatus_item']:
        cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}'")
        print(f"Columns in {table}:")
        print(cursor.fetchall())
