"""Dev utility: reset passwords for test users to 'test123' and clear first_login flag."""
import os
from pathlib import Path

env_path = Path("backend/.env")
for line in env_path.read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings.dev'
import sys
sys.path.insert(0, 'backend')
import django
django.setup()
from django.contrib.auth import get_user_model

User = get_user_model()

users_to_update = ["test_hod", "test_store_keeper", "test_staff", "staff_test", "admin_test"]

for eid in users_to_update:
    try:
        u = User.objects.get(employee_id=eid)
        u.set_password("test123")
        u.is_first_login = False
        u.save()
        print(f"  Updated {eid} ({u.role}) with default hashers")
    except User.DoesNotExist:
        print(f"  NOT FOUND: {eid}")

print(f"\nTotal users: {User.objects.count()}")
