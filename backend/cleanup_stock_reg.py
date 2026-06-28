import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("DROP TABLE IF EXISTS chemical_item CASCADE")
    cursor.execute("DROP TABLE IF EXISTS apparatus_item CASCADE")
    cursor.execute("DROP TABLE IF EXISTS stock_register CASCADE")
    cursor.execute("DELETE FROM django_migrations WHERE app = 'stock_register'")
print("Dropped stock_register tables and cleared migration history.")
