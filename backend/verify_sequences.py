import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def check_sync():
    with connection.cursor() as cursor:
        tables = ['stock_register', 'chemical_item', 'apparatus_item']
        for table in tables:
            cursor.execute(f"SELECT MAX(id) FROM {table}")
            max_id = cursor.fetchone()[0]
            
            # Using pg_get_serial_sequence to be safe
            cursor.execute(f"SELECT pg_get_serial_sequence('{table}', 'id')")
            seq_name = cursor.fetchone()[0]
            
            if seq_name:
                cursor.execute(f"SELECT last_value, is_called FROM {seq_name}")
                curr_val, is_called = cursor.fetchone()
                print(f"Table: {table}")
                print(f"  Max ID: {max_id}")
                print(f"  Sequence: {seq_name}")
                print(f"  Current Val: {curr_val}, Is Called: {is_called}")
                
                # If is_called is true, next value will be curr_val + 1
                # If is_called is false, next value will be curr_val
                next_val = curr_val + 1 if is_called else curr_val
                
                if max_id and max_id >= next_val:
                    print(f"  !!! ERROR: Sequence behind Max ID. Fixing...")
                    cursor.execute(f"SELECT setval('{seq_name}', {max_id + 1}, false)")
                    print(f"  Fixed: Next value will be {max_id + 1}")
                else:
                    print(f"  OK: Next value {next_val} is safe.")
            else:
                print(f"Table: {table} - No sequence found for 'id'")

if __name__ == "__main__":
    check_sync()
