"""Dev utility: reset password_must_change and failed_login_attempts for test users."""
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

for eid in ["staff_test", "admin_test"]:
    try:
        u = User.objects.get(employee_id=eid)
        u.password_must_change = False
        u.failed_login_attempts = 0
        u.account_locked_until = None
        u.save()
        print(f"  Fixed {eid}: password_must_change=False, failed_attempts=0")
    except User.DoesNotExist:
        print(f"  NOT FOUND: {eid}")
