from django.db import migrations


TRIGGER_SQL = """
CREATE OR REPLACE FUNCTION subtract_damaged_apparatus_item()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE available_apparatus
  SET available_quantity_pieces = GREATEST(available_quantity_pieces - NEW.quantity, 0),
      last_updated = CURRENT_DATE
  WHERE apparatus_name = NEW.apparatus_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS damaged_item_after_insert ON damaged_item;
CREATE TRIGGER damaged_item_after_insert
AFTER INSERT ON damaged_item
FOR EACH ROW
EXECUTE FUNCTION subtract_damaged_apparatus_item();
"""

DROP_TRIGGER_SQL = """
DROP TRIGGER IF EXISTS damaged_item_after_insert ON damaged_item;
DROP FUNCTION IF EXISTS subtract_damaged_apparatus_item();
"""


class Migration(migrations.Migration):

    dependencies = [
        ('damaged_entry', '0003_populate_caused_by'),
        ('inventory', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(TRIGGER_SQL, DROP_TRIGGER_SQL),
    ]
