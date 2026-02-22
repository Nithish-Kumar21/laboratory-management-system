import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def fix_sequences():
    with connection.cursor() as cursor:
        tables = ['stock_register', 'chemical_item', 'apparatus_item']
        for table in tables:
            print(f"Checking table: {table}")
            cursor.execute(f"SELECT MAX(id) FROM {table}")
            max_id = cursor.fetchone()[0]
            if max_id is None:
                max_id = 0
            
            cursor.execute(f"SELECT pg_get_serial_sequence('{table}', 'id')")
            seq_name = cursor.fetchone()[0]
            
            if seq_name:
                cursor.execute(f"SELECT last_value, is_called FROM {seq_name}")
                curr_val, is_called = cursor.fetchone()
                
                next_val = curr_val + 1 if is_called else curr_val
                
                print(f"  Current max_id: {max_id}")
                print(f"  Sequence {seq_name} next_val: {next_val}")
                
                if max_id >= next_val:
                    new_val = max_id + 1
                    print(f"  Updating sequence {seq_name} to {new_val}")
                    cursor.execute(f"SELECT setval('{seq_name}', {new_val}, false)")
                    print(f"  Successfully updated.")
                else:
                    print(f"  Sequence is OK.")
            else:
                print(f"  No sequence found.")
            print("-" * 20)

if __name__ == "__main__":
    fix_sequences()
