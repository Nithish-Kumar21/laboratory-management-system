"""
Populate dummy data for all sidebar modules using only the 3 test users:
  test_hod          (hod)
  test_store_keeper (store_keeper)
  test_staff        (staff)
"""
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from datetime import date, timedelta
from decimal import Decimal
from django.utils import timezone
from django.db import connection
from users.models import User
from inventory.models import AvailableChemical, AvailableApparatus, LabConfiguration
from stock_register.models import StockRegister, ChemicalItem, ApparatusItem
from damaged_entry.models import DamagedEntry, DamagedItem
from stock_request.models import StockRequest, StockRequestChemicalItem, StockRequestApparatusItem, IssueRegister, IssueChemicals

today = date.today()
hod = User.objects.get(employee_id='test_hod')
store = User.objects.get(employee_id='test_store_keeper')
staff = User.objects.get(employee_id='test_staff')

# ═══════════════════════════════════════════
#  MODULE 1: INVENTORY
# ═══════════════════════════════════════════
print("=" * 70)
print("  MODULE 1: INVENTORY")
print("=" * 70)

LabConfiguration.objects.create(
    use_common_reorder_level=True,
    common_chemical_reorder_level=Decimal('200.00'),
    common_apparatus_reorder_level=10
)
print("  [Lab Config] Created")

chemicals_data = [
    ('Hydrochloric Acid (1N)', Decimal('5000.00'), Decimal('500.00')),
    ('Sulfuric Acid (Conc.)', Decimal('3000.00'), Decimal('300.00')),
    ('Sodium Hydroxide (Pellets)', Decimal('2500.00'), Decimal('250.00')),
    ('Ethanol (Absolute)', Decimal('8000.00'), Decimal('800.00')),
    ('Acetone (HPLC Grade)', Decimal('4000.00'), Decimal('400.00')),
    ('Methanol (AR Grade)', Decimal('6000.00'), Decimal('600.00')),
    ('Nitric Acid (70%)', Decimal('2000.00'), Decimal('200.00')),
    ('Potassium Permanganate (0.1N)', Decimal('3000.00'), Decimal('300.00')),
    ('Ammonia Solution (30%)', Decimal('1500.00'), Decimal('150.00')),
    ('Chloroform (AR Grade)', Decimal('2500.00'), Decimal('250.00')),
]
for name, qty, reorder in chemicals_data:
    AvailableChemical.objects.create(chemical_name=name, available_quantity_ml=qty, reorder_level=reorder)
print(f"  [Chemicals] Added {len(chemicals_data)} entries")

apparatus_data = [
    ('Beaker 250ml (Borosil)', 50, 5),
    ('Beaker 500ml (Borosil)', 40, 4),
    ('Conical Flask 250ml', 35, 3),
    ('Conical Flask 500ml', 30, 3),
    ('Measuring Cylinder 100ml', 25, 3),
    ('Pipette 10ml (Volumetric)', 45, 5),
    ('Burette 50ml (with stopcock)', 20, 2),
    ('Test Tube (15x150mm)', 250, 25),
    ('Round Bottom Flask 1000ml', 15, 2),
    ('Thermometer (-10 to 110C)', 20, 3),
]
for name, qty, reorder in apparatus_data:
    AvailableApparatus.objects.create(apparatus_name=name, available_quantity_pieces=qty, reorder_level=reorder)
print(f"  [Apparatus] Added {len(apparatus_data)} entries")



# ═══════════════════════════════════════════
#  MODULE 2: STOCK REGISTER
# ═══════════════════════════════════════════
print()
print("=" * 70)
print("  MODULE 2: STOCK REGISTER")
print("=" * 70)

sr1 = StockRegister.objects.create(invoice_number='INV-2026-001', date=today - timedelta(days=60), supplier_name='Sigma Aldrich India', remarks='Chemicals for first semester labs')
ChemicalItem.objects.create(stock_register=sr1, chemical_name='Sulfuric Acid (Conc.)', quantity_ml=Decimal('2000.00'), rate=Decimal('850.00'), make='Merck')
ChemicalItem.objects.create(stock_register=sr1, chemical_name='Hydrochloric Acid (1N)', quantity_ml=Decimal('3000.00'), rate=Decimal('650.00'), make='Merck')
print(f"  [SR-001] {sr1.invoice_number} — Sigma Aldrich (2 chemicals)")

sr2 = StockRegister.objects.create(invoice_number='INV-2026-002', date=today - timedelta(days=45), supplier_name='Fisher Scientific Pvt Ltd', remarks='Glassware for practical sessions')
ApparatusItem.objects.create(stock_register=sr2, apparatus_name='Beaker 250ml (Borosil)', quantity_pieces=25, rate=Decimal('180.00'), make='Borosil')
ApparatusItem.objects.create(stock_register=sr2, apparatus_name='Conical Flask 250ml', quantity_pieces=20, rate=Decimal('220.00'), make='Borosil')
ApparatusItem.objects.create(stock_register=sr2, apparatus_name='Test Tube (15x150mm)', quantity_pieces=100, rate=Decimal('15.00'), make='Borosil')
print(f"  [SR-002] {sr2.invoice_number} — Fisher Scientific (3 apparatus)")

sr3 = StockRegister.objects.create(invoice_number='INV-2026-003', date=today - timedelta(days=30), supplier_name='Sisco Research Labs', remarks='Organic solvents for advanced labs')
ChemicalItem.objects.create(stock_register=sr3, chemical_name='Ethanol (Absolute)', quantity_ml=Decimal('5000.00'), rate=Decimal('1200.00'), make='SRL')
ChemicalItem.objects.create(stock_register=sr3, chemical_name='Acetone (HPLC Grade)', quantity_ml=Decimal('2000.00'), rate=Decimal('950.00'), make='SRL')
ChemicalItem.objects.create(stock_register=sr3, chemical_name='Methanol (AR Grade)', quantity_ml=Decimal('3000.00'), rate=Decimal('800.00'), make='SRL')
print(f"  [SR-003] {sr3.invoice_number} — Sisco Research (3 chemicals)")

sr4 = StockRegister.objects.create(invoice_number='INV-2026-004', date=today - timedelta(days=15), supplier_name='Borosil Glassworks Ltd', remarks='Titration glassware restock')
ApparatusItem.objects.create(stock_register=sr4, apparatus_name='Burette 50ml (with stopcock)', quantity_pieces=10, rate=Decimal('450.00'), make='Borosil')
ApparatusItem.objects.create(stock_register=sr4, apparatus_name='Pipette 10ml (Volumetric)', quantity_pieces=20, rate=Decimal('120.00'), make='Borosil')
ApparatusItem.objects.create(stock_register=sr4, apparatus_name='Measuring Cylinder 100ml', quantity_pieces=10, rate=Decimal('280.00'), make='Borosil')
print(f"  [SR-004] {sr4.invoice_number} — Borosil Glassworks (3 apparatus)")

sr5 = StockRegister.objects.create(invoice_number='INV-2026-005', date=today - timedelta(days=7), supplier_name='Thermo Fisher Scientific', remarks='Acids and glassware replenishment')
ChemicalItem.objects.create(stock_register=sr5, chemical_name='Nitric Acid (70%)', quantity_ml=Decimal('1000.00'), rate=Decimal('1100.00'), make='Thermo')
ChemicalItem.objects.create(stock_register=sr5, chemical_name='Ammonia Solution (30%)', quantity_ml=Decimal('1000.00'), rate=Decimal('750.00'), make='Thermo')
ChemicalItem.objects.create(stock_register=sr5, chemical_name='Chloroform (AR Grade)', quantity_ml=Decimal('1500.00'), rate=Decimal('1400.00'), make='Thermo')
ApparatusItem.objects.create(stock_register=sr5, apparatus_name='Round Bottom Flask 1000ml', quantity_pieces=8, rate=Decimal('520.00'), make='Borosil')
print(f"  [SR-005] {sr5.invoice_number} — Thermo Fisher (3 chemicals + 1 apparatus)")

# ═══════════════════════════════════════════
#  MODULE 3: CHEMICAL REQUEST
# ═══════════════════════════════════════════
print()
print("=" * 70)
print("  MODULE 3: CHEMICAL REQUEST")
print("=" * 70)

# Pending
req1 = StockRequest.objects.create(requested_by=staff, class_name='I B.Sc Chemistry', date=today - timedelta(days=3), status='pending', reason='Qualitative analysis practical needs concentrated acids')
StockRequestChemicalItem.objects.create(stock_request=req1, chemical_name='Sulfuric Acid (Conc.)', quantity_ml=Decimal('200.00'))
StockRequestChemicalItem.objects.create(stock_request=req1, chemical_name='Hydrochloric Acid (1N)', quantity_ml=Decimal('300.00'))
print(f"  [REQ-001] {req1.request_id} — Pending")

req2 = StockRequest.objects.create(requested_by=staff, class_name='II M.Sc Chemistry', date=today - timedelta(days=2), status='pending', reason='Organic synthesis needs ethanol and acetone')
StockRequestChemicalItem.objects.create(stock_request=req2, chemical_name='Ethanol (Absolute)', quantity_ml=Decimal('500.00'))
StockRequestChemicalItem.objects.create(stock_request=req2, chemical_name='Acetone (HPLC Grade)', quantity_ml=Decimal('200.00'))
print(f"  [REQ-002] {req2.request_id} — Pending")

# Accepted
req3 = StockRequest.objects.create(requested_by=staff, class_name='I M.Sc Chemistry', date=today - timedelta(days=5), status='accepted', reason='Inorganic practical needs ammonia and nitric acid', reviewed_by=hod, reviewed_at=timezone.now() - timedelta(days=4))
StockRequestChemicalItem.objects.create(stock_request=req3, chemical_name='Ammonia Solution (30%)', quantity_ml=Decimal('300.00'))
StockRequestChemicalItem.objects.create(stock_request=req3, chemical_name='Nitric Acid (70%)', quantity_ml=Decimal('200.00'))
print(f"  [REQ-003] {req3.request_id} — Accepted")

req4 = StockRequest.objects.create(requested_by=staff, class_name='I B.Sc Chemistry', date=today - timedelta(days=7), status='accepted', reason='Titration practical needs HCl and NaOH', reviewed_by=hod, reviewed_at=timezone.now() - timedelta(days=6))
StockRequestChemicalItem.objects.create(stock_request=req4, chemical_name='Hydrochloric Acid (1N)', quantity_ml=Decimal('500.00'))
StockRequestChemicalItem.objects.create(stock_request=req4, chemical_name='Sodium Hydroxide (Pellets)', quantity_ml=Decimal('300.00'))
print(f"  [REQ-004] {req4.request_id} — Accepted")

# Issued
req5 = StockRequest.objects.create(requested_by=staff, class_name='II B.Sc Chemistry', date=today - timedelta(days=10), status='issued', reason='Volumetric analysis needs KMnO4', reviewed_by=hod, reviewed_at=timezone.now() - timedelta(days=9), issued_by=store, issued_at=timezone.now() - timedelta(days=8))
StockRequestChemicalItem.objects.create(stock_request=req5, chemical_name='Potassium Permanganate (0.1N)', quantity_ml=Decimal('400.00'))
print(f"  [REQ-005] {req5.request_id} — Issued")

req6 = StockRequest.objects.create(requested_by=staff, class_name='III B.Sc Chemistry', date=today - timedelta(days=12), status='issued', reason='Organic lab needs methanol and chloroform', reviewed_by=hod, reviewed_at=timezone.now() - timedelta(days=11), issued_by=store, issued_at=timezone.now() - timedelta(days=10))
StockRequestChemicalItem.objects.create(stock_request=req6, chemical_name='Methanol (AR Grade)', quantity_ml=Decimal('300.00'))
StockRequestChemicalItem.objects.create(stock_request=req6, chemical_name='Chloroform (AR Grade)', quantity_ml=Decimal('200.00'))
print(f"  [REQ-006] {req6.request_id} — Issued")

# Reported
req7 = StockRequest.objects.create(requested_by=staff, class_name='II M.Sc Chemistry', date=today - timedelta(days=15), status='reported', reason='Spectroscopy sample preparation', reviewed_by=hod, reviewed_at=timezone.now() - timedelta(days=14), issued_by=store, issued_at=timezone.now() - timedelta(days=13), reported_at=timezone.now() - timedelta(days=11))
StockRequestChemicalItem.objects.create(stock_request=req7, chemical_name='Ethanol (Absolute)', quantity_ml=Decimal('400.00'), actual_used_quantity_ml=Decimal('340.00'))
StockRequestChemicalItem.objects.create(stock_request=req7, chemical_name='Chloroform (AR Grade)', quantity_ml=Decimal('150.00'), actual_used_quantity_ml=Decimal('127.50'))
print(f"  [REQ-007] {req7.request_id} — Reported")

req8 = StockRequest.objects.create(requested_by=staff, class_name='I B.Sc Chemistry', date=today - timedelta(days=18), status='reported', reason='Acid-base titration practical', reviewed_by=hod, reviewed_at=timezone.now() - timedelta(days=17), issued_by=store, issued_at=timezone.now() - timedelta(days=16), reported_at=timezone.now() - timedelta(days=14))
StockRequestChemicalItem.objects.create(stock_request=req8, chemical_name='Hydrochloric Acid (1N)', quantity_ml=Decimal('250.00'), actual_used_quantity_ml=Decimal('212.50'))
StockRequestChemicalItem.objects.create(stock_request=req8, chemical_name='Sodium Hydroxide (Pellets)', quantity_ml=Decimal('200.00'), actual_used_quantity_ml=Decimal('170.00'))
print(f"  [REQ-008] {req8.request_id} — Reported")

# Completed
req9 = StockRequest.objects.create(requested_by=staff, class_name='II B.Sc Chemistry', date=today - timedelta(days=20), status='completed', reason='Titration lab completed', reviewed_by=hod, reviewed_at=timezone.now() - timedelta(days=19), issued_by=store, issued_at=timezone.now() - timedelta(days=18), reported_at=timezone.now() - timedelta(days=16), completed_at=timezone.now() - timedelta(days=15))
StockRequestChemicalItem.objects.create(stock_request=req9, chemical_name='Sulfuric Acid (Conc.)', quantity_ml=Decimal('150.00'), actual_used_quantity_ml=Decimal('127.50'))
StockRequestChemicalItem.objects.create(stock_request=req9, chemical_name='Potassium Permanganate (0.1N)', quantity_ml=Decimal('200.00'), actual_used_quantity_ml=Decimal('170.00'))
print(f"  [REQ-009] {req9.request_id} — Completed")

req10 = StockRequest.objects.create(requested_by=staff, class_name='III B.Sc Chemistry', date=today - timedelta(days=25), status='completed', reason='Organic chemistry practical done', reviewed_by=hod, reviewed_at=timezone.now() - timedelta(days=24), issued_by=store, issued_at=timezone.now() - timedelta(days=23), reported_at=timezone.now() - timedelta(days=21), completed_at=timezone.now() - timedelta(days=20))
StockRequestChemicalItem.objects.create(stock_request=req10, chemical_name='Acetone (HPLC Grade)', quantity_ml=Decimal('300.00'), actual_used_quantity_ml=Decimal('255.00'))
StockRequestChemicalItem.objects.create(stock_request=req10, chemical_name='Ethanol (Absolute)', quantity_ml=Decimal('600.00'), actual_used_quantity_ml=Decimal('510.00'))
print(f"  [REQ-010] {req10.request_id} — Completed")

# ═══════════════════════════════════════════
#  MODULE 4: DAMAGED ENTRY
# ═══════════════════════════════════════════
print()
print("=" * 70)
print("  MODULE 4: DAMAGED ENTRY")
print("=" * 70)

de1 = DamagedEntry.objects.create(staff=staff.full_name, class_name='I B.Sc Chemistry', date=today - timedelta(days=60), details='Beaker cracked during heating experiment due to thermal stress.')
DamagedItem.objects.create(damaged_entry=de1, apparatus_name='Beaker 250ml (Borosil)', quantity=3, caused_by='Thermal stress')
print(f"  [DE-001] {de1.staff} — Beaker 250ml x3")

de2 = DamagedEntry.objects.create(staff=staff.full_name, class_name='II B.Sc Chemistry', date=today - timedelta(days=45), details='Test tube broken while handling with tongs.')
DamagedItem.objects.create(damaged_entry=de2, apparatus_name='Test Tube (15x150mm)', quantity=10, caused_by='Mishandling with tongs')
print(f"  [DE-002] {de2.staff} — Test Tube x10")

de3 = DamagedEntry.objects.create(staff=staff.full_name, class_name='I B.Sc Chemistry', date=today - timedelta(days=30), details='Mercury thermometer dropped and broken during distillation setup.')
DamagedItem.objects.create(damaged_entry=de3, apparatus_name='Thermometer (-10 to 110C)', quantity=2, caused_by='Dropped during setup')
print(f"  [DE-003] {de3.staff} — Thermometer x2")

de4 = DamagedEntry.objects.create(staff=staff.full_name, class_name='I M.Sc Chemistry', date=today - timedelta(days=15), details='Conical flask shattered during titration practical.')
DamagedItem.objects.create(damaged_entry=de4, apparatus_name='Conical Flask 500ml', quantity=2, caused_by='Excessive force during titration')
DamagedItem.objects.create(damaged_entry=de4, apparatus_name='Beaker 500ml (Borosil)', quantity=1, caused_by='Accidental knock-off')
print(f"  [DE-004] {de4.staff} — Conical Flask 500ml x2, Beaker 500ml x1")

de5 = DamagedEntry.objects.create(staff=staff.full_name, class_name='III B.Sc Chemistry', date=today - timedelta(days=3), details='Stopcock of burette broke due to mishandling.')
DamagedItem.objects.create(damaged_entry=de5, apparatus_name='Burette 50ml (with stopcock)', quantity=1, caused_by='Mishandling of stopcock')
print(f"  [DE-005] {de5.staff} — Burette 50ml x1")

# ═══════════════════════════════════════════
#  MODULE 5: ISSUE REGISTER
# ═══════════════════════════════════════════
print()
print("=" * 70)
print("  MODULE 5: ISSUE REGISTER")
print("=" * 70)

with connection.cursor() as cursor:
    cursor.execute("INSERT INTO issue_register (request_code, stock_request_db_id, staff_name, class, date, status) VALUES (%s, %s, %s, %s, %s, %s)", [req9.request_id, req9.id, staff.full_name, 'II B.Sc Chemistry', today - timedelta(days=18), 'completed'])
    ir1_id = cursor.lastrowid
    cursor.execute("INSERT INTO issue_chemicals (ir_id, chemical_name, issued_quantity, actual_usage) VALUES (%s, %s, %s, %s)", [ir1_id, 'Sulfuric Acid (Conc.)', 150.00, 127.50])
    cursor.execute("INSERT INTO issue_chemicals (ir_id, chemical_name, issued_quantity, actual_usage) VALUES (%s, %s, %s, %s)", [ir1_id, 'Potassium Permanganate (0.1N)', 200.00, 170.00])
    print(f"  [IR-001] IR#{ir1_id} — {staff.full_name} — completed")

    cursor.execute("INSERT INTO issue_register (request_code, stock_request_db_id, staff_name, class, date, status) VALUES (%s, %s, %s, %s, %s, %s)", [req10.request_id, req10.id, staff.full_name, 'III B.Sc Chemistry', today - timedelta(days=23), 'completed'])
    ir2_id = cursor.lastrowid
    cursor.execute("INSERT INTO issue_chemicals (ir_id, chemical_name, issued_quantity, actual_usage) VALUES (%s, %s, %s, %s)", [ir2_id, 'Acetone (HPLC Grade)', 300.00, 255.00])
    cursor.execute("INSERT INTO issue_chemicals (ir_id, chemical_name, issued_quantity, actual_usage) VALUES (%s, %s, %s, %s)", [ir2_id, 'Ethanol (Absolute)', 600.00, 510.00])
    print(f"  [IR-002] IR#{ir2_id} — {staff.full_name} — completed")

    cursor.execute("INSERT INTO issue_register (request_code, stock_request_db_id, staff_name, class, date, status) VALUES (%s, %s, %s, %s, %s, %s)", [req7.request_id, req7.id, staff.full_name, 'II M.Sc Chemistry', today - timedelta(days=13), 'reported'])
    ir3_id = cursor.lastrowid
    cursor.execute("INSERT INTO issue_chemicals (ir_id, chemical_name, issued_quantity, actual_usage) VALUES (%s, %s, %s, %s)", [ir3_id, 'Ethanol (Absolute)', 400.00, 340.00])
    cursor.execute("INSERT INTO issue_chemicals (ir_id, chemical_name, issued_quantity, actual_usage) VALUES (%s, %s, %s, %s)", [ir3_id, 'Chloroform (AR Grade)', 150.00, 127.50])
    print(f"  [IR-003] IR#{ir3_id} — {staff.full_name} — reported")

    cursor.execute("INSERT INTO issue_register (request_code, stock_request_db_id, staff_name, class, date, status) VALUES (%s, %s, %s, %s, %s, %s)", [req8.request_id, req8.id, staff.full_name, 'I B.Sc Chemistry', today - timedelta(days=16), 'reported'])
    ir4_id = cursor.lastrowid
    cursor.execute("INSERT INTO issue_chemicals (ir_id, chemical_name, issued_quantity, actual_usage) VALUES (%s, %s, %s, %s)", [ir4_id, 'Hydrochloric Acid (1N)', 250.00, 212.50])
    cursor.execute("INSERT INTO issue_chemicals (ir_id, chemical_name, issued_quantity, actual_usage) VALUES (%s, %s, %s, %s)", [ir4_id, 'Sodium Hydroxide (Pellets)', 200.00, 170.00])
    print(f"  [IR-004] IR#{ir4_id} — {staff.full_name} — reported")

# ═══════════════════════════════════════════
#  MODULE 6: DRAFT
# ═══════════════════════════════════════════
print()
print("=" * 70)
print("  MODULE 6: DRAFT")
print("=" * 70)

draft1 = StockRequest.objects.create(requested_by=staff, class_name='I B.Sc Chemistry', date=today - timedelta(days=1), status='draft', reason='Draft for upcoming titration lab - not yet submitted')
StockRequestChemicalItem.objects.create(stock_request=draft1, chemical_name='Sodium Hydroxide (Pellets)', quantity_ml=Decimal('250.00'))
StockRequestChemicalItem.objects.create(stock_request=draft1, chemical_name='Hydrochloric Acid (1N)', quantity_ml=Decimal('300.00'))
print(f"  [DRAFT-001] {draft1.request_id} — Draft")

draft2 = StockRequest.objects.create(requested_by=staff, class_name='II M.Sc Chemistry', date=today - timedelta(days=1), status='draft', reason='Draft for research project - yet to finalize quantities')
StockRequestChemicalItem.objects.create(stock_request=draft2, chemical_name='Methanol (AR Grade)', quantity_ml=Decimal('400.00'))
StockRequestChemicalItem.objects.create(stock_request=draft2, chemical_name='Chloroform (AR Grade)', quantity_ml=Decimal('250.00'))
print(f"  [DRAFT-002] {draft2.request_id} — Draft")

draft3 = StockRequest.objects.create(requested_by=staff, class_name='I M.Sc Chemistry', date=today - timedelta(days=1), status='draft', reason='Draft for inorganic analysis - solvents to be confirmed')
StockRequestChemicalItem.objects.create(stock_request=draft3, chemical_name='Nitric Acid (70%)', quantity_ml=Decimal('150.00'))
StockRequestChemicalItem.objects.create(stock_request=draft3, chemical_name='Ammonia Solution (30%)', quantity_ml=Decimal('200.00'))
StockRequestApparatusItem.objects.create(stock_request=draft3, apparatus_name='Conical Flask 500ml', quantity_pieces=10)
print(f"  [DRAFT-003] {draft3.request_id} — Draft")

# ── Summary ──
print()
print("=" * 70)
print("  POPULATION COMPLETE - SUMMARY")
print("=" * 70)
print(f"  Users:                   {User.objects.count()}")
print(f"  Lab Configuration:       {LabConfiguration.objects.count()}")
print(f"  Available Chemicals:     {AvailableChemical.objects.count()}")
print(f"  Available Apparatus:     {AvailableApparatus.objects.count()}")
print(f"  Stock Register Entries:  {StockRegister.objects.count()}")
print(f"  Chemical Items (SR):     {ChemicalItem.objects.count()}")
print(f"  Apparatus Items (SR):    {ApparatusItem.objects.count()}")
print(f"  Damaged Entries:         {DamagedEntry.objects.count()}")
print(f"  Damaged Items:           {DamagedItem.objects.count()}")
print(f"  Stock Requests:          {StockRequest.objects.count()}")
print(f"  Chemical Items (REQ):    {StockRequestChemicalItem.objects.count()}")
print(f"  Apparatus Items (REQ):   {StockRequestApparatusItem.objects.count()}")
print(f"  Issue Register Entries:  {IssueRegister.objects.count()}")
print(f"  Issue Chemicals:         {IssueChemicals.objects.count()}")
print(f"  Drafts:                  {StockRequest.objects.filter(status='draft').count()}")
print("=" * 70)
