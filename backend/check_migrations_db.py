import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("SELECT app, name, applied FROM django_migrations WHERE app = 'stock_request'")
    for row in cursor.fetchall():
        print(f"{row[0]} | {row[1]} | {row[2]}")
