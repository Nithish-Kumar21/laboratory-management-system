import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT column_name, is_generated, generation_expression 
        FROM information_schema.columns 
        WHERE table_name = 'issue_chemicals'
    """)
    for row in cursor.fetchall():
        print(row)
