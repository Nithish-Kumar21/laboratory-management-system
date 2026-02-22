import os
import django
from decimal import Decimal
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from stock_register.models import StockRegister, ChemicalItem, ApparatusItem
from damaged_entry.models import DamagedEntry, DamagedItem

try:
    print("Populating Stock Register...")
    
    # Create Stock Register Entry
    stock_entry, created = StockRegister.objects.get_or_create(
        invoice_number="INV-2024-001",
        defaults={
            "date": date(2024, 1, 15),
            "supplier_name": "Scientific Supplies Co."
        }
    )
    if created:
        print(f"Created Stock Entry: {stock_entry.invoice_number}")
    else:
        print(f"Stock Entry already exists: {stock_entry.invoice_number}")

    # Add Chemical Items
    if not ChemicalItem.objects.filter(stock_register=stock_entry, chemical_name="Sulfuric Acid").exists():
        ChemicalItem.objects.create(
            stock_register=stock_entry,
            chemical_name="Sulfuric Acid",
            quantity_ml=Decimal("1000.00"),
            rate=Decimal("1500.00"),
            make="Merck"
        )
        print("Added Sulfuric Acid to Stock")

    # Add Apparatus Items
    if not ApparatusItem.objects.filter(stock_register=stock_entry, apparatus_name="Beaker 500ml").exists():
        ApparatusItem.objects.create(
            stock_register=stock_entry,
            apparatus_name="Beaker 500ml",
            quantity_pieces=50,
            rate=Decimal("120.00"),
            make="Borosil"
        )
        print("Added Beaker to Stock")

    print("\nPopulating Damaged Entry...")
    
    # Create Damaged Entry
    damaged_entry, created = DamagedEntry.objects.get_or_create(
        staff="Test Staff",
        date=date(2024, 1, 20),
        defaults={
            "class_name": "B.Sc Chemistry II",
            "caused_by": "Student Accident",
            "details": "Beaker slipped during titration."
        }
    )
    
    if created:
        print(f"Created Damaged Entry for {damaged_entry.date}")
    else:
        print(f"Damaged Entry already exists for {damaged_entry.date}")

    # Add Damaged Item
    if not DamagedItem.objects.filter(damaged_entry=damaged_entry, apparatus_name="Beaker 500ml").exists():
        DamagedItem.objects.create(
            damaged_entry=damaged_entry,
            apparatus_name="Beaker 500ml",
            quantity=2
        )
        print("Added Damaged Beaker Record")

except Exception as e:
    print(f"Error: {e}")
