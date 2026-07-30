"""Dev utility: list all PostgreSQL databases on localhost."""
import psycopg2
try:
    conn = psycopg2.connect(host='localhost', port=5432, user='postgres', password='postgres', dbname='postgres')
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
    for row in cur.fetchall():
        print(row[0])
    conn.close()
except Exception as e:
    print(f"Error: {e}")
