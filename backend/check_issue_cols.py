import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
with connection.cursor() as c:
    for table in ('issue_register', 'issue_chemicals'):
        print('=== ' + table + ' ===')
        c.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = %s ORDER BY ordinal_position", [table])
        for r in c.fetchall():
            print('  ' + r[0].ljust(30) + ' ' + r[1])
        print()
