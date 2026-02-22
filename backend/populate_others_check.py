import os
import django
from decimal import Decimal
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from stock_register.models import StockRegister, ChemicalItem, ApparatusItem, InvoiceItem
from damaged_entry.models import DamagedEntry, DamagedItem
from users.models import User

# --- Stock Register ---
try:
    print("Populating Stock Register...")
    
    # helper: ensure we have models imported correctly
    # Note: I need to check if InvoiceItem is a separate model or how items are linked.
    # Looking at the migration, I saw ChemicalItem and ApparatusItem but no obvious foreign key in migration 0001?
    # Wait, migration 0001 for stock_register didn't show ForeignKeys in the CreateModel calls I saw earlier? 
    # Let me re-read the migration file content carefully.
    
    # Reviewing d:\laboratory-management-system\backend\stock_register\migrations\0001_initial.py output from Step 170:
    # StockRegister has invoice_number...
    # ChemicalItem and ApparatusItem are created but I don't see ForeignKeys to StockRegister in the fields list shown in Step 170.
    # This implies the ForeignKeys might be in a later migration OR the models definitions in models.py define them but migration didn't pick it up if 'managed=False' was on.
    # Actually, if managed=False, the fields in migration are just what Django "thinks" the table looks like. 
    # I should check the models.py to see the actual relationships before writing this script.
    pass 
except Exception as e:
    print(f"Error preparing stock script: {e}")

