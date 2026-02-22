import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def final_fix():
    print("Starting final sequence synchronization...")
    with connection.cursor() as cursor:
        tables = ['stock_register', 'chemical_item', 'apparatus_item']
        for table in tables:
            # Get max ID
            cursor.execute(f"SELECT MAX(id) FROM {table}")
            max_id = cursor.fetchone()[0] or 0
            
            # Get sequence name
            cursor.execute(f"SELECT pg_get_serial_sequence('{table}', 'id')")
            seq_name = cursor.fetchone()[0]
            
            if seq_name:
                # Update sequence to max_id + 1
                new_val = max_id + 1
                cursor.execute(f"SELECT setval('{seq_name}', {new_val}, false)")
                
                # Verify
                cursor.execute(f"SELECT last_value, is_called FROM {seq_name}")
                curr_val, is_called = cursor.fetchone()
                next_val = curr_val + 1 if is_called else curr_val
                
                print(f"Table {table}: Max ID {max_id}, Sequence {seq_name} reset to next_val {next_val}")
                if next_val > max_id:
                    print(f"  Result: SUCCESS")
                else:
                    print(f"  Result: FAILURE")
            else:
                print(f"Table {table}: No sequence found")

if __name__ == "__main__":
    final_fix()
