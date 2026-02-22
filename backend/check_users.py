import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from users.models import User
try:
    print(f'Users: {list(User.objects.values_list("employee_id", flat=True))}')
except Exception as e:
    print(f"Error: {e}")
