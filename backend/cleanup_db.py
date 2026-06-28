import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("DROP TABLE IF EXISTS request_chemicals CASCADE")
    cursor.execute("DROP TABLE IF EXISTS requests CASCADE")
    cursor.execute("DROP TABLE IF EXISTS stock_request_chemical_item CASCADE")
    cursor.execute("DROP TABLE IF EXISTS stock_request_apparatus_item CASCADE")
    cursor.execute("DROP TABLE IF EXISTS stock_request CASCADE")
    cursor.execute("DELETE FROM django_migrations WHERE app = 'stock_request'")
print("Dropped old tables and cleared migration history for stock_request.")
