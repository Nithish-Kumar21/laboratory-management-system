import sqlite3
import os
db_path = os.path.join(os.path.dirname(__file__), 'db.sqlite3')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
for table in ['stock_register', 'chemical_item', 'apparatus_item']:
    cursor.execute(f"PRAGMA table_info({table})")
    print(f'{table}:', cursor.fetchall())
conn.close()
