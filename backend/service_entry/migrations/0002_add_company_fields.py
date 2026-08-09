from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('service_entry', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
ALTER TABLE service_entry ADD COLUMN IF NOT EXISTS company_name VARCHAR(128);
ALTER TABLE service_entry ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE service_entry ADD COLUMN IF NOT EXISTS company_contact_country_code VARCHAR(5);
ALTER TABLE service_entry ADD COLUMN IF NOT EXISTS company_contact_number VARCHAR(10);
""",
            reverse_sql="""
ALTER TABLE service_entry DROP COLUMN IF EXISTS company_name;
ALTER TABLE service_entry DROP COLUMN IF EXISTS company_address;
ALTER TABLE service_entry DROP COLUMN IF EXISTS company_contact_country_code;
ALTER TABLE service_entry DROP COLUMN IF EXISTS company_contact_number;
""",
        ),
    ]
