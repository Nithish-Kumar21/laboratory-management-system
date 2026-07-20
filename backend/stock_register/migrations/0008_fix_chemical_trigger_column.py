from django.db import migrations

CHEM_TRIGGER_SQL = """
CREATE OR REPLACE FUNCTION update_available_chemicals()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO available_chemicals (chemical_name, quantity, unit, last_updated)
  VALUES (NEW.chemical_name, NEW.total_quantity, NEW.unit, CURRENT_DATE)
  ON CONFLICT (chemical_name) DO UPDATE
    SET quantity = available_chemicals.quantity + NEW.total_quantity,
        unit = NEW.unit,
        last_updated = CURRENT_DATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

REVERSE_CHEM_TRIGGER_SQL = """
CREATE OR REPLACE FUNCTION update_available_chemicals()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO available_chemicals (chemical_name, quantity, unit, last_updated)
  VALUES (NEW.chemical_name, NEW.quantity, NEW.unit, CURRENT_DATE)
  ON CONFLICT (chemical_name) DO UPDATE
    SET quantity = available_chemicals.quantity + NEW.quantity,
        unit = NEW.unit,
        last_updated = CURRENT_DATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('stock_register', '0007_merge_20260709_1513'),
    ]

    operations = [
        migrations.RunSQL(
            sql=CHEM_TRIGGER_SQL,
            reverse_sql=REVERSE_CHEM_TRIGGER_SQL,
        ),
    ]
