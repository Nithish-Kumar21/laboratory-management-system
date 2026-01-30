import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def debug_columns():
    with connection.cursor() as cursor:
        print("DEBUG: Fetching all column names for chemical_item...")
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'chemical_item'")
        cols = [c[0] for c in cursor.fetchall()]
        print(f"Columns for chemical_item: {cols}")
        
        print("\nDEBUG: Fetching all column names for apparatus_item...")
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'apparatus_item'")
        cols = [c[0] for c in cursor.fetchall()]
        print(f"Columns for apparatus_item: {cols}")

if __name__ == "__main__":
    debug_columns()
