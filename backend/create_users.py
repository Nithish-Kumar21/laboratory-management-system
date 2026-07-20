import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings.dev')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()

def create_or_update_user(eid, email, pwd, role, name):
    user, created = User.objects.get_or_create(
        employee_id=eid,
        defaults={
            'email': email,
            'full_name': name,
            'role': role,
            'department': 'B.Sc Chemistry',
            'designation': role.upper(),
            'phone': f'+91{eid[-10:]}' if len(eid) >= 10 else f'+91{eid.ljust(10, "0")[:10]}',
            'password_must_change': False
        }
    )
    user.set_password(pwd)
    user.role = role
    user.password_must_change = False
    user.save()
    print(f"User {eid} {'created' if created else 'updated'}")

# HOD
create_or_update_user('test_hod', 'hod_test@test.com', 'hod@123456', 'hod', 'Test HOD')
# Store Keeper
create_or_update_user('test_store_keeper', 'sk_test@test.com', 'storekeeper@123456', 'store_keeper', 'Test Store Keeper')
# Staff
create_or_update_user('test_staff', 'staff_test@test.com', 'staff@123456', 'staff', 'Test Staff')
