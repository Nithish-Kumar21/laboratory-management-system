import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'requests'")
    print("Columns in 'requests':")
    for row in cursor.fetchall():
        print(row[0])
    
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'request_chemicals'")
    print("\nColumns in 'request_chemicals':")
    for row in cursor.fetchall():
        print(row[0])
