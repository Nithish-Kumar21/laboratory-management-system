import os
import django
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import authenticate, get_user_model
User = get_user_model()

print("--- Validating User Credentials ---")

users = User.objects.all()

passwords_to_try = [
    'admin123',
    'admin@123456',
    'hod@123456',
    'storekeeper@123456',
    'staff@123456',
    'password',
    '123456'
]

for user in users:
    print(f"\nUser: {user.employee_id} ({user.role})")
    
    if not user.is_active:
        print("  [WARN] User is INACTIVE")
        
    if user.is_account_locked():
        print(f"  [WARN] User is LOCKED until {user.account_locked_until}")
        
    success = False
    for pwd in passwords_to_try:
        # We use the user.check_password direct method to avoid side effects of login attempts (lockout)
        # But for final verification we should use authenticate to ensure backend logic holds
        if user.check_password(pwd):
            print(f"  [SUCCESS] Password is: '{pwd}'")
            success = True
            break
            
    if not success:
        print("  [FAIL] Could not find valid password among common defaults.")
