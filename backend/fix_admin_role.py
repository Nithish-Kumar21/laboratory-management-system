
import os
import django
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

try:
    user = User.objects.get(employee_id='admin')
    print(f"Current role: '{user.role}'")
    
    if user.role != 'admin':
        print("Updating role to 'admin'...")
        user.role = 'admin'
        user.save()
        print("Role updated successfully.")
    else:
        print("Role is already 'admin'.")
        
except User.DoesNotExist:
    print("User 'admin' not found.")
