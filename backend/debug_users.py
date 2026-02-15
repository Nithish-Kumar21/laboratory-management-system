
import os
import django
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import User as UserModel

User = get_user_model()

print(f"User model: {User}")
print(f"USERNAME_FIELD: {User.USERNAME_FIELD}")

print("\n--- Users ---")
users = User.objects.all()
if not users.exists():
    print("No users found in the database.")
else:
    for u in users:
        print(f"ID: {u.id}")
        print(f"  EmployeeID: {u.employee_id}")
        print(f"  Email: {u.email}")
        print(f"  Active: {u.is_active}")
        print(f"  Staff: {u.is_staff}")
        print(f"  Role: {u.role}")
        print(f"  Locked Until: {u.account_locked_until}")
        print(f"  Is Locked: {u.is_account_locked()}")
        print(f"  Failed Attempts: {u.failed_login_attempts}")
        
        # Check password hash (just length/prefix)
        print(f"  Password set: {bool(u.password)}")
        if u.password.startswith('pbkdf2_') or u.password.startswith('argon2'):
            print(f"  Password seems hashed.")
        else:
            print(f"  Password might be plain text or invalid format: {u.password[:20]}...")
        print("-" * 20)
