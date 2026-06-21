import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from inventory.models import AvailableChemical, AvailableApparatus, LabConfiguration
from django.db import IntegrityError

try:
    # Create Lab Configuration
    lab_config, created = LabConfiguration.objects.get_or_create(
        id=1,
        defaults={
            "use_common_reorder_level": False,
            "common_chemical_reorder_level": 10.0,
            "common_apparatus_reorder_level": 5
        }
    )
    print(f"Lab Config Created/Found")

    # Create Chemicals
    chemicals = [
        {"chemical_name": "Sulfuric Acid", "available_quantity_ml": 5000.00, "reorder_level": 1000.00},
        {"chemical_name": "Hydrochloric Acid", "available_quantity_ml": 3000.00, "reorder_level": 500.00},
        {"chemical_name": "Sodium Hydroxide", "available_quantity_ml": 2000.00, "reorder_level": 200.00},
    ]

    for chem_data in chemicals:
        # Check by name to avoid duplicates if running multiple times
        if not AvailableChemical.objects.filter(chemical_name=chem_data["chemical_name"]).exists():
            chem = AvailableChemical.objects.create(**chem_data)
            print(f"Created Chemical: {chem.chemical_name}")
        else:
            print(f"Chemical already exists: {chem_data['chemical_name']}")

    # Create Apparatus
    apparatus_list = [
        {"apparatus_name": "Beaker 500ml", "available_quantity_pieces": 50, "reorder_level": 10},
        {"apparatus_name": "Test Tube", "available_quantity_pieces": 200, "reorder_level": 50},
        {"apparatus_name": "Pipette 10ml", "available_quantity_pieces": 30, "reorder_level": 5},
    ]

    for app_data in apparatus_list:
        if not AvailableApparatus.objects.filter(apparatus_name=app_data["apparatus_name"]).exists():
            app = AvailableApparatus.objects.create(**app_data)
            print(f"Created Apparatus: {app.apparatus_name}")
        else:
            print(f"Apparatus already exists: {app_data['apparatus_name']}")

except Exception as e:
    print(f"Error: {e}")
