import os
import django
from datetime import date
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from damaged_entry.models import DamagedEntry, DamagedItem

try:
    de = DamagedEntry.objects.create(
        staff='Test Staff',
        class_name='I B.Sc Chemistry',
        date=date.today(),
        details='Accidental breakage'
    )
    di = DamagedItem.objects.create(
        damaged_entry=de,
        apparatus_name='Test Beaker',
        quantity=2,
        caused_by='Student A'
    )
    print(f"Damaged Entry created: {de.id}")
    de.delete() # Cleanup
    print("Damaged Entry deleted (cleanup).")
except Exception as e:
    print(f"FAILED: {e}")
