import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from users.models import User
try:
    u = User.objects.get(employee_id='admin')
    u.set_password('admin123')
    u.save()
    print("Admin password reset to 'admin123'")
except User.DoesNotExist:
    print("Admin user does not exist")
except Exception as e:
    print(f"Error: {e}")
