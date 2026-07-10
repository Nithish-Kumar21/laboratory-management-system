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


class Migration(migrations.Migration):

    dependencies = [
        ('stock_register', '0005_create_inventory_triggers'),
    ]

    operations = [
        migrations.RunSQL(
            sql=r"""
                DO $$
                BEGIN
                    -- Rename quantity to pack_size (test DB has quantity, prod already renamed)
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='chemical_item' AND column_name='quantity'
                    ) THEN
                        ALTER TABLE chemical_item RENAME COLUMN quantity TO pack_size;
                    END IF;

                    -- Add new columns (IF NOT EXISTS makes this safe for prod)
                    ALTER TABLE stock_register
                        ADD COLUMN IF NOT EXISTS supplier_contact_country_code VARCHAR(5) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS supplier_contact_phone VARCHAR(20) NOT NULL DEFAULT '',
                        ADD COLUMN IF NOT EXISTS supplier_email VARCHAR(100) NOT NULL DEFAULT '';

                    ALTER TABLE chemical_item
                        ADD COLUMN IF NOT EXISTS no_of_packs INTEGER NOT NULL DEFAULT 1,
                        ADD COLUMN IF NOT EXISTS total_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS total_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

                    ALTER TABLE apparatus_item
                        ADD COLUMN IF NOT EXISTS total_price NUMERIC(12, 2) NOT NULL DEFAULT 0;
                END $$;
            """,
            reverse_sql="""
                ALTER TABLE stock_register
                    DROP COLUMN IF EXISTS supplier_contact_country_code,
                    DROP COLUMN IF EXISTS supplier_contact_phone,
                    DROP COLUMN IF EXISTS supplier_email;
                ALTER TABLE chemical_item
                    DROP COLUMN IF EXISTS no_of_packs,
                    DROP COLUMN IF EXISTS total_quantity,
                    DROP COLUMN IF EXISTS total_price;
                ALTER TABLE apparatus_item
                    DROP COLUMN IF EXISTS total_price;
            """
        ),
        migrations.RunSQL(
            sql=CHEM_TRIGGER_SQL,
            reverse_sql="""
                CREATE OR REPLACE FUNCTION update_available_chemicals()
                RETURNS TRIGGER AS $$
                BEGIN
                  INSERT INTO available_chemicals (chemical_name, quantity, unit, last_updated)
                  VALUES (NEW.chemical_name, NEW.pack_size, NEW.unit, CURRENT_DATE)
                  ON CONFLICT (chemical_name) DO UPDATE
                    SET quantity = available_chemicals.quantity + NEW.pack_size,
                        unit = NEW.unit,
                        last_updated = CURRENT_DATE;
                  RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            """
        ),
    ]
