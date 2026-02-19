import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
cursor = connection.cursor()
cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'issue_register' ORDER BY ordinal_position")
for row in cursor.fetchall():
    print(row)
