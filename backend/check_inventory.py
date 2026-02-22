import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from inventory.models import AvailableChemical, AvailableApparatus

print(f"Chemicals count: {AvailableChemical.objects.count()}")
print(f"Apparatus count: {AvailableApparatus.objects.count()}")

if AvailableChemical.objects.count() > 0:
    print("Sample Chemical:", AvailableChemical.objects.first())

if AvailableApparatus.objects.count() > 0:
    print("Sample Apparatus:", AvailableApparatus.objects.first())
