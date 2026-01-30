import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def add_columns():
    with connection.cursor() as cursor:
        print("Checking/Adding 'make' column to chemical_item...")
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'chemical_item' AND column_name = 'make'")
        if not cursor.fetchone():
            print("Adding 'make' column to chemical_item...")
            cursor.execute("ALTER TABLE chemical_item ADD COLUMN make VARCHAR(100) DEFAULT ''")
            print("Done.")
        else:
            print("'make' column already exists in chemical_item.")

        print("Checking/Adding 'make' column to apparatus_item...")
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'apparatus_item' AND column_name = 'make'")
        if not cursor.fetchone():
            print("Adding 'make' column to apparatus_item...")
            cursor.execute("ALTER TABLE apparatus_item ADD COLUMN make VARCHAR(100) DEFAULT ''")
            print("Done.")
        else:
            print("'make' column already exists in apparatus_item.")

if __name__ == "__main__":
    add_columns()
