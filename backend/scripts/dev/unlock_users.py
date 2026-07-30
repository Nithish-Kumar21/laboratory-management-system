"""Dev utility: unlock all locked test user accounts."""
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
from django.utils import timezone

User = get_user_model()

for u in User.objects.filter(employee_id__in=["test_hod", "test_store_keeper", "test_staff", "staff_test", "admin_test"]):
    u.failed_login_attempts = 0
    u.account_locked_until = None
    u.save()
    print(f"  Unlocked {u.employee_id}")
