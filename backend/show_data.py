import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from datetime import date
from users.models import User
from inventory.models import AvailableChemical, AvailableApparatus
from stock_register.models import StockRegister, ChemicalItem, ApparatusItem
from damaged_entry.models import DamagedEntry, DamagedItem
from stock_request.models import StockRequest, StockRequestChemicalItem, IssueRegister, IssueChemicals

today = date.today()

def print_sep(title):
    print()
    print(f"{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")

# ── 1. USERS ──
print_sep("MODULE 1: USERS  (table: user_account)")
for u in User.objects.all().order_by('employee_id'):
    print(f"  [{u.employee_id}] {u.full_name:25s} | role: {u.role:15s} | dept: {u.department or '-':20s} | active: {u.is_active}")

# ── 2. INVENTORY - Chemicals ──
print_sep("MODULE 2A: INVENTORY - CHEMICALS  (table: available_chemicals)")
for c in AvailableChemical.objects.all().order_by('chemical_name'):
    print(f"  '{c.chemical_name:35s}' qty: {str(c.quantity):>8s} {c.unit} | reorder: {str(c.reorder_level):>8s} {c.unit}")

# ── 2b. INVENTORY - Apparatus ──
print_sep("MODULE 2B: INVENTORY - APPARATUS  (table: available_apparatus)")
for a in AvailableApparatus.objects.all().order_by('apparatus_name'):
    print(f"  '{a.apparatus_name:40s}' qty: {a.available_quantity_pieces:3d} pcs | reorder: {a.reorder_level} pcs")

# ── 3. STOCK REGISTER ──
print_sep("MODULE 3: STOCK REGISTER  (tables: stock_register + chemical_item + apparatus_item)")
for sr in StockRegister.objects.all().order_by('-date'):
    chems = ', '.join([f"{c.chemical_name} ({c.quantity}{c.unit})" for c in sr.chemical_items.all()])
    apps = ', '.join([f"{a.apparatus_name} ({a.quantity_pieces}pcs)" for a in sr.apparatus_items.all()])
    items = (chems + (' | ' if chems and apps else '') + apps) or '(no items)'
    print(f"  INV: {sr.invoice_number:20s} | date: {sr.date} | supplier: {sr.supplier_name:25s}")
    print(f"       Items: {items}")

# ── 4. DAMAGED ENTRY ──
print_sep("MODULE 4: DAMAGED ENTRY  (tables: damaged_entry + damaged_item)")
for de in DamagedEntry.objects.all().order_by('-date'):
    items = ', '.join([f"{i.apparatus_name} x{i.quantity}" for i in de.damaged_items.all()])
    print(f"  ID#{de.id} | staff: {de.staff:20s} | class: {de.class_name:20s} | date: {de.date}")
    print(f"       Damaged: {items}")
    print(f"       Details: {de.details}")

# ── 5. STOCK REQUEST ──
print_sep("MODULE 5: CHEMICAL REQUEST  (tables: stock_request + stock_request_chemical_item)")
for req in StockRequest.objects.all().order_by('-created_at'):
    chems = ', '.join([f"{c.chemical_name} ({c.quantity}{c.unit})" for c in req.chemical_items.all()])
    print(f"  {req.request_id:15s} | status: {req.status:12s} | by: {req.requested_by.full_name:20s} | class: {req.class_name:20s}")
    print(f"       Chemicals: {chems}")
    print(f"       Reason: {req.reason}")

# ── 6. ISSUE REGISTER ──
print_sep("MODULE 6: ISSUE REGISTER  (tables: issue_register + issue_chemicals)")
for ir in IssueRegister.objects.all().order_by('-date'):
    chems = ', '.join([f"{c.chemical_name} (issued: {c.issued_quantity}{c.unit}, used: {c.actual_usage}{c.unit})" for c in ir.chemicals.all()])
    print(f"  IR#{ir.ir_id} | code: {ir.request_code or '-':15s} | staff: {ir.staff_name:20s} | class: {ir.class_field:20s} | date: {ir.date}")
    print(f"       Chemicals: {chems}")

print()
print("=" * 70)
print("  Each module stores data in its own SQLite tables (db.sqlite3)")
print("=" * 70)
