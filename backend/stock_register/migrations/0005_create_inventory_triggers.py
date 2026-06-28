from django.db import migrations

TRIGGER_SQL = """
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

DROP TRIGGER IF EXISTS chemical_item_after_insert ON chemical_item;
CREATE TRIGGER chemical_item_after_insert
AFTER INSERT ON chemical_item
FOR EACH ROW
EXECUTE FUNCTION update_available_chemicals();

CREATE OR REPLACE FUNCTION update_available_apparatus()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO available_apparatus (apparatus_name, available_quantity_pieces, last_updated)
  VALUES (NEW.apparatus_name, NEW.quantity_pieces, CURRENT_DATE)
  ON CONFLICT (apparatus_name) DO UPDATE
    SET available_quantity_pieces = available_apparatus.available_quantity_pieces + NEW.quantity_pieces,
        last_updated = CURRENT_DATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apparatus_item_after_insert ON apparatus_item;
CREATE TRIGGER apparatus_item_after_insert
AFTER INSERT ON apparatus_item
FOR EACH ROW
EXECUTE FUNCTION update_available_apparatus();
"""

DROP_TRIGGER_SQL = """
DROP TRIGGER IF EXISTS chemical_item_after_insert ON chemical_item;
DROP TRIGGER IF EXISTS apparatus_item_after_insert ON apparatus_item;
DROP FUNCTION IF EXISTS update_available_chemicals();
DROP FUNCTION IF EXISTS update_available_apparatus();
"""


class Migration(migrations.Migration):

    dependencies = [
        ('stock_register', '0004_fix_column_names'),
        ('inventory', '0005_add_unique_constraints'),
    ]

    operations = [
        migrations.RunSQL(TRIGGER_SQL, DROP_TRIGGER_SQL),
    ]
