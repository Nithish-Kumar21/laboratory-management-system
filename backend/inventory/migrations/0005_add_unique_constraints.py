from django.db import migrations


ADD_UNIQUE_CONSTRAINTS_SQL = """
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'UNIQUE'
      AND table_name = 'available_chemicals'
      AND constraint_name = 'available_chemicals_chemical_name_key'
  ) THEN
    ALTER TABLE available_chemicals
    ADD CONSTRAINT available_chemicals_chemical_name_key UNIQUE (chemical_name);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'UNIQUE'
      AND table_name = 'available_apparatus'
      AND constraint_name = 'available_apparatus_apparatus_name_key'
  ) THEN
    ALTER TABLE available_apparatus
    ADD CONSTRAINT available_apparatus_apparatus_name_key UNIQUE (apparatus_name);
  END IF;
END;
$$;
"""

DROP_UNIQUE_CONSTRAINTS_SQL = """
ALTER TABLE available_chemicals DROP CONSTRAINT IF EXISTS available_chemicals_chemical_name_key;
ALTER TABLE available_apparatus DROP CONSTRAINT IF EXISTS available_apparatus_apparatus_name_key;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_fix_column_names'),
    ]

    operations = [
        migrations.RunSQL(ADD_UNIQUE_CONSTRAINTS_SQL, DROP_UNIQUE_CONSTRAINTS_SQL),
    ]
