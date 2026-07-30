"""Dev utility: create or update test users for E2E testing."""
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings_test'
import sys
sys.path.insert(0, 'backend')
import django
django.setup()
from django.contrib.auth import get_user_model

User = get_user_model()

for eid, pwd in [("test_hod", "test123"), ("test_store_keeper", "test123"), ("test_staff", "test123")]:
    try:
        u = User.objects.get(employee_id=eid)
        u.set_password(pwd)
        u.is_first_login = False
        u.save()
        print(f"  Updated {eid} ({u.role})")
    except User.DoesNotExist:
        print(f"  NOT FOUND: {eid}")

staff_data = {"employee_id": "staff_test", "email": "staff_e2e@test.com", "role": "staff", "full_name": "Staff Test User", "phone": "+919999999997", "designation": "Staff", "department": "B.Sc Chemistry"}
if not User.objects.filter(employee_id="staff_test").exists():
    u = User(**staff_data)
    u.set_password("test123")
    u.is_first_login = False
    u.save()
    print(f"  CREATED staff_test")
else:
    u = User.objects.get(employee_id="staff_test")
    u.set_password("test123")
    u.is_first_login = False
    u.save()
    print(f"  Updated staff_test")

admin_data = {"employee_id": "admin_test", "email": "admin_e2e@test.com", "role": "admin", "full_name": "Admin Test User", "phone": "+919999999998", "designation": "Admin", "department": "B.Sc Chemistry", "is_staff": True, "is_superuser": True}
if not User.objects.filter(employee_id="admin_test").exists():
    u = User(**admin_data)
    u.set_password("test123")
    u.is_first_login = False
    u.save()
    print(f"  CREATED admin_test")
else:
    u = User.objects.get(employee_id="admin_test")
    u.set_password("test123")
    u.is_first_login = False
    u.save()
    print(f"  Updated admin_test")

print(f"\nTotal users: {User.objects.count()}")
for u in User.objects.all():
    print(f"  {u.employee_id} ({u.role}) first_login={u.is_first_login}")
