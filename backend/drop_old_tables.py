import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute('DROP TABLE IF EXISTS chemical_issue_register_item CASCADE;')
    cursor.execute('DROP TABLE IF EXISTS chemical_issue_register CASCADE;')
print("Dropped old tables.")
