from inventory.models import AvailableChemical, AvailableApparatus, LabConfiguration
from django.utils import timezone

# Create Lab Configuration
lab_config, created = LabConfiguration.objects.get_or_create(
    use_common_reorder_level=False,
    defaults={
        "common_chemical_reorder_level": 10.0,
        "common_apparatus_reorder_level": 5
    }
)
print(f"Lab Config Created/Found")

# Create Chemicals
chemicals = [
    {"chemical_name": "Sulfuric Acid", "quantity": 5000.00, "unit": "ml", "reorder_level": 1000.00},
    {"chemical_name": "Hydrochloric Acid", "quantity": 3000.00, "unit": "ml", "reorder_level": 500.00},
    {"chemical_name": "Sodium Hydroxide", "quantity": 2000.00, "unit": "ml", "reorder_level": 200.00},
]

for chem_data in chemicals:
    chem, created = AvailableChemical.objects.get_or_create(
        chemical_name=chem_data["chemical_name"],
        defaults=chem_data
    )
    if created:
        print(f"Created Chemical: {chem.chemical_name}")
    else:
        print(f"Chemical already exists: {chem.chemical_name}")

# Create Apparatus
apparatus_list = [
    {"apparatus_name": "Beaker 500ml", "available_quantity_pieces": 50, "reorder_level": 10},
    {"apparatus_name": "Test Tube", "available_quantity_pieces": 200, "reorder_level": 50},
    {"apparatus_name": "Pipette 10ml", "available_quantity_pieces": 30, "reorder_level": 5},
]

for app_data in apparatus_list:
    app, created = AvailableApparatus.objects.get_or_create(
        apparatus_name=app_data["apparatus_name"],
        defaults=app_data
    )
    if created:
        print(f"Created Apparatus: {app.apparatus_name}")
    else:
        print(f"Apparatus already exists: {app.apparatus_name}")
