from django.db import connection

def check_constraint():
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT pg_get_constraintdef(c.oid) 
            FROM pg_constraint c 
            JOIN pg_class t ON t.oid = c.conrelid
            WHERE c.conname = 'chk_role'
        """)
        row = cursor.fetchone()
        if row:
            print(f"Constraint chk_role: {row[0]}")
        else:
            print("Constraint chk_role not found")

if __name__ == "__main__":
    check_constraint()
