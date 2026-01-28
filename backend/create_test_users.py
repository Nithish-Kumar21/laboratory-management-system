from django.contrib.auth import get_user_model
User = get_user_model()

users_to_create = [
    {
        'employee_id': 'test_hod',
        'full_name': 'Test HOD',
        'email': 'hod@test.com',
        'password': 'hod@123456',
        'role': 'hod',
        'phone': '+911111111111',
        'designation': 'Head of Department',
        'department': 'B.Sc Chemistry',
        'password_must_change': False
    },
    {
        'employee_id': 'test_store_keeper',
        'full_name': 'Test Store Keeper',
        'email': 'sk@test.com',
        'password': 'storekeeper@123456',
        'role': 'store_keeper',
        'phone': '+912222222222',
        'designation': 'Store Keeper',
        'department': 'B.Sc Chemistry',
        'password_must_change': False
    },
    {
        'employee_id': 'test_staff',
        'full_name': 'Test Staff',
        'email': 'staff@test.com',
        'password': 'staff@123456',
        'role': 'staff',
        'phone': '+913333333333',
        'designation': 'Assistant Professor',
        'department': 'B.Sc Chemistry',
        'password_must_change': False
    }
]

for user_data in users_to_create:
    employee_id = user_data['employee_id']
    if not User.objects.filter(employee_id=employee_id).exists():
        password = user_data.pop('password')
        user = User.objects.create_user(password=password, **user_data)
        print(f"Created user: {employee_id} ({user_data['role']})")
    else:
        print(f"User {employee_id} already exists.")
