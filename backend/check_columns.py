import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from stock_register.models import ChemicalItem, ApparatusItem

print('ChemicalItem fields:')
for f in ChemicalItem._meta.get_fields():
    if hasattr(f, 'column'):
        print(f'  {f.name} => column: {f.column}')
    else:
        print(f'  {f.name} (non-column)')

print('\nApparatusItem fields:')
for f in ApparatusItem._meta.get_fields():
    if hasattr(f, 'column'):
        print(f'  {f.name} => column: {f.column}')
    else:
        print(f'  {f.name} (non-column)')

# Check if quantity column exists in actual DB
from django.db import connection
with connection.cursor() as c:
    c.execute("SELECT column_name FROM information_schema.columns WHERE table_name='chemical_item'")
    cols = [r[0] for r in c.fetchall()]
    print('\nActual chemical_item columns:', cols)
