"""Dev utility: list all users with their first_login status."""
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings_test'
import sys
sys.path.insert(0, 'backend')
import django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
print("Existing users:")
for u in User.objects.all():
    print(f"  {u.employee_id} ({u.role}) - first_login={u.is_first_login}")
print(f"Total: {User.objects.count()}")
