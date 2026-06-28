"""
Create a new stock register entry (invoice + chemical/apparatus items).
Run from backend folder: python create_stock_register_entry.py

Ensure migrations are applied first: python manage.py migrate
"""
import os
import django
from decimal import Decimal
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from stock_register.models import StockRegister, ChemicalItem, ApparatusItem

# Use a unique invoice number (e.g. based on today)
TODAY = date.today()
INVOICE_NUMBER = f"INV-{TODAY:%Y-%m-%d}-001"

def create_entry():
    if StockRegister.objects.filter(invoice_number=INVOICE_NUMBER).exists():
        print(f"Entry already exists: {INVOICE_NUMBER}")
        print("Use a different invoice number or delete the existing entry first.")
        return

    stock_entry = StockRegister.objects.create(
        invoice_number=INVOICE_NUMBER,
        date=TODAY,
        supplier_name="Lab Supplies Inc.",
    )
    print(f"Created Stock Register entry: {stock_entry.invoice_number}")

    ChemicalItem.objects.create(
        stock_register=stock_entry,
        chemical_name="Hydrochloric Acid",
        quantity=Decimal("500.00"),
        unit='ml',
        rate=Decimal("800.00"),
        make="Merck",
    )
    print("  - Added chemical: Hydrochloric Acid")

    ApparatusItem.objects.create(
        stock_register=stock_entry,
        apparatus_name="Test Tube",
        quantity_pieces=100,
        rate=Decimal("15.00"),
        make="Borosil",
    )
    print("  - Added apparatus: Test Tube")

    print("Done. New entry is in the stock register list.")


if __name__ == "__main__":
    create_entry()
