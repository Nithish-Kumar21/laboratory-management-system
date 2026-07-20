"""
Create test users so you can log in.
Run from backend folder: python create_test_users.py
Then log in with employee ID and password below.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings.dev')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

users_to_create = [
    {
        'employee_id': 'admin',
        'full_name': 'Admin User',
        'email': 'admin@test.com',
        'password': 'admin@123456',
        'role': 'hod',
        'phone': '+910000000000',
        'designation': 'Administrator',
        'department': 'B.Sc Chemistry',
        'password_must_change': False
    },
    {
        'employee_id': 'test_hod',
        'full_name': 'Test HOD',
        'email': 'test_hod@lab.com',
        'password': 'hod@123456',
        'role': 'hod',
        'phone': '+910000000001',
        'designation': 'Head of Department',
        'department': 'B.Sc Chemistry',
        'password_must_change': False
    },
    {
        'employee_id': 'test_store_keeper',
        'full_name': 'Test Store Keeper',
        'email': 'test_sk@lab.com',
        'password': 'storekeeper@123456',
        'role': 'store_keeper',
        'phone': '+910000000002',
        'designation': 'Store Keeper',
        'department': 'B.Sc Chemistry',
        'password_must_change': False
    },
    {
        'employee_id': 'test_staff',
        'full_name': 'Test Staff',
        'email': 'test_staff@lab.com',
        'password': 'staff@123456',
        'role': 'staff',
        'phone': '+910000000003',
        'designation': 'Assistant Professor',
        'department': 'B.Sc Chemistry',
        'password_must_change': False
    }
]

if __name__ == '__main__':
    print("Creating test users (run migrations first if tables don't exist: python manage.py migrate)\n")
    for user_data in users_to_create:
        employee_id = user_data['employee_id']
        if not User.objects.filter(employee_id=employee_id).exists():
            password = user_data.pop('password')
            user = User.objects.create_user(password=password, **user_data)
            print(f"Created user: {employee_id} (password: see below)")
        else:
            print(f"User {employee_id} already exists.")
    print("\nYou can log in with:")
    print("  Employee ID: admin       Password: admin@123456")
    print("  Employee ID: test_hod    Password: hod@123456")
    print("  Employee ID: test_store_keeper  Password: storekeeper@123456")
    print("  Employee ID: test_staff  Password: staff@123456")
