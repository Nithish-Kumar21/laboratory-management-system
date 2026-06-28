"""
Delete all users and data, create only 3 test users.
"""
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
from users.models import User
from inventory.models import AvailableChemical, AvailableApparatus, LabConfiguration
from stock_register.models import StockRegister, ChemicalItem, ApparatusItem
from damaged_entry.models import DamagedEntry, DamagedItem
from stock_request.models import StockRequest, StockRequestChemicalItem, StockRequestApparatusItem, IssueRegister, IssueChemicals

print("Step 1: Deleting all data...")
IssueChemicals.objects.all().delete()
IssueRegister.objects.all().delete()
StockRequestApparatusItem.objects.all().delete()
StockRequestChemicalItem.objects.all().delete()
StockRequest.objects.all().delete()
DamagedItem.objects.all().delete()
DamagedEntry.objects.all().delete()
ChemicalItem.objects.all().delete()
ApparatusItem.objects.all().delete()
StockRegister.objects.all().delete()

LabConfiguration.objects.all().delete()
AvailableChemical.objects.all().delete()
AvailableApparatus.objects.all().delete()

tables = [
    'available_chemicals','available_apparatus',
    'lab_configuration',
    'stock_register','chemical_item','apparatus_item',
    'damaged_entry','damaged_item',
    'stock_request','stock_request_chemical_item','stock_request_apparatus_item',
]
with connection.cursor() as c:
    for t in tables:
        c.execute(f"DELETE FROM sqlite_sequence WHERE name='{t}'")
print("All data deleted.")

print("Step 2: Deleting all existing users...")
User.objects.all().delete()
print("All users deleted.")

print("Step 3: Creating 3 test users...")
hod = User.objects.create_user(
    employee_id='test_hod', email='hod@test.com', full_name='Test HOD',
    password='hod@123456', role='hod', department='B.Sc Chemistry',
    designation='Head of Department', phone='+911111111111',
    password_must_change=False, is_active=True
)
print(f"Created: {hod.employee_id} (hod)")

store = User.objects.create_user(
    employee_id='test_store_keeper', email='sk@test.com', full_name='Test Store Keeper',
    password='storekeeper@123456', role='store_keeper', department='B.Sc Chemistry',
    designation='Store Keeper', phone='+912222222222',
    password_must_change=False, is_active=True
)
print(f"Created: {store.employee_id} (store_keeper)")

staff = User.objects.create_user(
    employee_id='test_staff', email='staff@test.com', full_name='Test Staff',
    password='staff@123456', role='staff', department='B.Sc Chemistry',
    designation='Assistant Professor', phone='+913333333333',
    password_must_change=False, is_active=True
)
print(f"Created: {staff.employee_id} (staff)")

print(f"\nTotal users: {User.objects.count()}")
for u in User.objects.all():
    print(f"  {u.employee_id:20s} | {u.role:15s} | active={u.is_active}")
