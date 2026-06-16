"""
Add one set of dummy data per module.
Run: python manage.py shell < add_dummy_data.py
"""
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal
from users.models import User
from inventory.models import AvailableChemical, AvailableApparatus, LabConfiguration
from stock_register.models import StockRegister, ChemicalItem, ApparatusItem
from damaged_entry.models import DamagedEntry, DamagedItem
from stock_request.models import StockRequest, StockRequestChemicalItem, IssueRegister, IssueChemicals

today = date.today()

print("=" * 60)
print("ADDING DUMMY DATA - ONE PER MODULE")
print("=" * 60)

# ─────────────────────────────────────────────
# 1. USER module
# ─────────────────────────────────────────────
staff_user, created = User.objects.get_or_create(
    employee_id='STAFF005',
    defaults={
        'full_name': 'Ravi Kumar',
        'email': 'ravi.kumar@gnc.edu.in',
        'phone': '+919876543210',
        'role': 'staff',
        'designation': 'Lab Assistant',
        'department': 'B.Sc Chemistry',
        'is_active': True,
    }
)
if created:
    staff_user.set_password('staff123')
    staff_user.save()
    print(f"[USER] Created: '{staff_user.full_name}' ({staff_user.employee_id}) role={staff_user.role}")
else:
    print(f"[USER] Already exists: '{staff_user.full_name}'")

# ─────────────────────────────────────────────
# 2. INVENTORY module
# ─────────────────────────────────────────────
chem, created = AvailableChemical.objects.get_or_create(
    chemical_name='Sodium Hydroxide',
    defaults={
        'quantity': Decimal('500.00'),
        'unit': 'ml',
        'reorder_level': Decimal('100.00'),
    }
)
if created:
    print(f"[INVENTORY-CHEM] Created: '{chem.chemical_name}' qty={chem.quantity}{chem.unit}")
else:
    print(f"[INVENTORY-CHEM] Already exists: '{chem.chemical_name}'")

app, created = AvailableApparatus.objects.get_or_create(
    apparatus_name='Volumetric Flask (250ml)',
    defaults={
        'available_quantity_pieces': 30,
        'reorder_level': 5,
    }
)
if created:
    print(f"[INVENTORY-APP] Created: '{app.apparatus_name}' qty={app.available_quantity_pieces}pcs")
else:
    print(f"[INVENTORY-APP] Already exists: '{app.apparatus_name}'")

# ─────────────────────────────────────────────
# 3. STOCK REGISTER module
# ─────────────────────────────────────────────
sr, created = StockRegister.objects.get_or_create(
    invoice_number='INV-2026-004',
    defaults={
        'date': today - timedelta(days=10),
        'supplier_name': 'Sigma Aldrich India',
        'remarks': 'Quarterly stock replenishment',
    }
)
if created:
    ChemicalItem.objects.create(
        stock_register=sr, chemical_name='Sodium Hydroxide',
        quantity=Decimal('500.00'), unit='ml', rate=Decimal('1200.00'), make='Merck'
    )
    ApparatusItem.objects.create(
        stock_register=sr, apparatus_name='Volumetric Flask (250ml)',
        quantity_pieces=30, rate=Decimal('350.00'), make='Borocil'
    )
    print(f"[STOCK REGISTER] Created: '{sr.invoice_number}' (supplier: {sr.supplier_name})")
else:
    print(f"[STOCK REGISTER] Already exists: '{sr.invoice_number}'")

# ─────────────────────────────────────────────
# 4. DAMAGED ENTRY module
# ─────────────────────────────────────────────
de, created = DamagedEntry.objects.get_or_create(
    staff='Priya Sharma',
    class_name='II B.Sc Chemistry',
    date=today - timedelta(days=5),
    details='Beaker cracked during heating experiment due to thermal stress.',
)
if created:
    item = DamagedItem.objects.create(
        damaged_entry=de, apparatus_name='Beaker (250ml)',
        quantity=3, caused_by='Thermal stress during heating'
    )
    print(f"[DAMAGED ENTRY] Created: staff='{de.staff}', item='{item.apparatus_name}' qty={item.quantity}")
else:
    print(f"[DAMAGED ENTRY] Already exists: staff='{de.staff}'")

# ─────────────────────────────────────────────
# 5. STOCK REQUEST module
# ─────────────────────────────────────────────
staff_user = User.objects.filter(role='staff').first()
hod_user = User.objects.filter(role='hod').first()
store_user = User.objects.filter(role='store_keeper').first()

if staff_user and hod_user:
    req, created = StockRequest.objects.get_or_create(
        request_id='REQ-2026-003',
        defaults={
            'requested_by': staff_user,
            'class_name': 'II B.Sc Chemistry',
            'date': today - timedelta(days=3),
            'status': 'pending',
            'reason': 'Titration experiments for upcoming practical session',
        }
    )
    if created:
        StockRequestChemicalItem.objects.create(
            stock_request=req, chemical_name='Sodium Hydroxide',
            quantity=Decimal('200.00')
        )
        print(f"[STOCK REQUEST] Created: '{req.request_id}' (status: {req.status})")
    else:
        print(f"[STOCK REQUEST] Already exists: '{req.request_id}'")
else:
    print("[STOCK REQUEST] Skipped - need staff and hod users in DB")

# ─────────────────────────────────────────────
# 6. ISSUE REGISTER module
# ─────────────────────────────────────────────
ir = IssueRegister.objects.create(
    request_code='REQ-2026-002',
    stock_request_db_id=1,
    staff_name='Demo Staff',
    class_field='I B.Sc Chemistry',
    date=today - timedelta(days=1),
    status='completed',
)
IssueChemicals.objects.create(
    ir=ir, chemical_name='Hydrochloric Acid',
    issued_quantity=Decimal('100.00'), unit='ml', actual_usage=Decimal('85.00')
)
print(f"[ISSUE REGISTER] Created: IR#{ir.ir_id} (staff: {ir.staff_name})")

print()
print("=" * 60)
print("DUMMY DATA SUMMARY")
print("=" * 60)
print(f"  Users:              {User.objects.count()}")
print(f"  Available Chemicals: {AvailableChemical.objects.count()}")
print(f"  Available Apparatus: {AvailableApparatus.objects.count()}")
print(f"  Stock Register:     {StockRegister.objects.count()}")
print(f"  Damaged Entries:    {DamagedEntry.objects.count()}")
print(f"  Stock Requests:     {StockRequest.objects.count()}")
print(f"  Issue Register:     {IssueRegister.objects.count()}")
print("=" * 60)
