
import os
import django
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import authenticate, get_user_model
User = get_user_model()

username = 'admin'
password = 'admin123'

print(f"Testing authentication for user '{username}' with password '{password}'...")

try:
    user = User.objects.get(employee_id=username)
    print(f"User found: {user}")
    print(f"Is active: {user.is_active}")
    print(f"Is locked: {user.is_account_locked()}")
    
    # Test check_password directly
    is_correct = user.check_password(password)
    print(f"Password check result for '{password}': {is_correct}")
    
    # Test authenticate
    auth_user = authenticate(username=username, password=password)
    print(f"Authenticate result: {auth_user}")
    
    if auth_user:
        print("Authentication SUCCESSFUL")
    else:
        print("Authentication FAILED")

except User.DoesNotExist:
    print(f"User '{username}' does not exist.")
