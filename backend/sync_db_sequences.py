import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def sync_sequences():
    with connection.cursor() as cursor:
        print("Checking sequences for stock_register, chemical_item, and apparatus_item...")
        
        tables = ['stock_register', 'chemical_item', 'apparatus_item']
        
        for table in tables:
            # Get max ID
            cursor.execute(f"SELECT MAX(id) FROM {table}")
            max_id = cursor.fetchone()[0]
            if max_id is None:
                max_id = 0
            
            # Get current sequence value
            # Assuming sequence name is {table}_id_seq
            seq_name = f"{table}_id_seq"
            
            try:
                cursor.execute(f"SELECT last_value FROM {seq_name}")
                curr_val = cursor.fetchone()[0]
                
                print(f"Table: {table}")
                print(f"  Max ID: {max_id}")
                print(f"  Sequence current value: {curr_val}")
                
                if max_id >= curr_val:
                    new_val = max_id + 1
                    print(f"  Updating sequence {seq_name} to {new_val}...")
                    cursor.execute(f"SELECT setval('{seq_name}', {new_val}, false)")
                    print(f"  Updated successfully.")
                else:
                    print(f"  Sequence is already ahead of max ID.")
            except Exception as e:
                print(f"  Error checking sequence {seq_name}: {e}")
                # Try to find the sequence name if the default doesn't work
                cursor.execute(f"SELECT pg_get_serial_sequence('{table}', 'id')")
                real_seq_name_res = cursor.fetchone()
                if real_seq_name_res and real_seq_name_res[0]:
                    real_seq_name = real_seq_name_res[0]
                    print(f"  Real sequence name found: {real_seq_name}")
                    cursor.execute(f"SELECT last_value FROM {real_seq_name}")
                    curr_val = cursor.fetchone()[0]
                    if max_id >= curr_val:
                        new_val = max_id + 1
                        cursor.execute(f"SELECT setval('{real_seq_name}', {new_val}, false)")
                        print(f"  Updated real sequence {real_seq_name} to {new_val}.")
                else:
                    print(f"  Could not find sequence for {table}.id")

if __name__ == "__main__":
    sync_sequences()
