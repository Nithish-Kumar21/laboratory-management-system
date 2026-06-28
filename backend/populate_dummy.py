import os
import django
from datetime import date, timedelta
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from inventory.models import AvailableChemical, AvailableApparatus
from stock_request.models import StockRequest, StockRequestChemicalItem
from stock_register.models import StockRegister, ChemicalItem, ApparatusItem
from damaged_entry.models import DamagedEntry, DamagedItem
from django.contrib.auth import get_user_model

User = get_user_model()

def populate_dummy_data():
    print("--- Populating Dummy Data ---")
    
    # Get users
    staff = User.objects.get(employee_id='test_staff')
    hod = User.objects.get(employee_id='test_hod')
    store_keeper = User.objects.get(employee_id='test_store_keeper')

    # 1. Available Chemicals
    chemicals = [
        ('Hydrochloric Acid', 5000.0, 500.0),
        ('Sulfuric Acid', 3000.0, 300.0),
        ('Sodium Hydroxide', 2000.0, 200.0),
        ('Ethanol', 10000.0, 1000.0),
        ('Acetone', 4000.0, 400.0)
    ]
    for name, qty, reorder in chemicals:
        AvailableChemical.objects.update_or_create(
            chemical_name=name,
            defaults={'available_quantity_ml': qty, 'reorder_level': reorder}
        )
    print("    Added 5 Chemicals.")

    # 2. Available Apparatus
    apparatus = [
        ('Beaker 250ml', 50, 5),
        ('Conical Flask 500ml', 30, 3),
        ('Test Tube', 200, 20),
        ('Pipette 10ml', 40, 4),
        ('Burette 50ml', 25, 2)
    ]
    for name, qty, reorder in apparatus:
        AvailableApparatus.objects.update_or_create(
            apparatus_name=name,
            defaults={'available_quantity_pieces': qty, 'reorder_level': reorder}
        )
    print("    Added 5 Apparatus.")

    # 3. Stock Requests (5 stages)
    stages = ['pending', 'accepted', 'issued', 'reported', 'completed']
    for i, stage in enumerate(stages):
        sr = StockRequest.objects.create(
            requested_by=staff,
            class_name='I B.Sc Chemistry',
            date=date.today() - timedelta(days=i),
            status=stage,
            reason=f"Experiment {i+1}"
        )
        StockRequestChemicalItem.objects.create(
            stock_request=sr,
            chemical_name=chemicals[i%5][0],
            quantity_ml=100.00,
            actual_used_quantity_ml=80.00 if stage in ['reported', 'completed'] else None
        )
        if stage in ['accepted', 'issued', 'reported', 'completed']:
            sr.reviewed_by = hod
            sr.reviewed_at = timezone.now() if hasattr(sr, 'reviewed_at') else None
        if stage in ['issued', 'reported', 'completed']:
            sr.issued_by = store_keeper
        sr.save()
    print("    Added 5 Stock Requests.")

    # 4. Stock Register (Arrivals)
    for i in range(5):
        reg = StockRegister.objects.create(
            date=date.today() - timedelta(days=i*5),
            invoice_number=f"INV-{1000+i}",
            supplier_name=f"Supplier {chr(65+i)}"
        )
        ChemicalItem.objects.create(
            stock_register=reg,
            chemical_name=chemicals[i%5][0],
            quantity_ml=1000.00,
            make="TestBrand",
            rate=150.00
        )
    print("    Added 5 Stock Register entries.")

    # 5. Damaged Entries
    for i in range(5):
        de = DamagedEntry.objects.create(
            staff=staff.full_name,
            class_name='II B.Sc Chemistry',
            date=date.today() - timedelta(days=i*2),
            details=f"Accident in lab session {i+1}"
        )
        DamagedItem.objects.create(
            damaged_entry=de,
            apparatus_name=apparatus[i%5][0],
            quantity=1,
            caused_by=f"Student {i+101}"
        )
    print("    Added 5 Damaged Entries.")

    print("\n--- Dummy Data Population Complete ---")

if __name__ == '__main__':
    from django.utils import timezone
    populate_dummy_data()
