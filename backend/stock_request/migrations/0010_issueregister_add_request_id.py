# Manual migration to add request_id column to the unmanaged issue_register table.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('stock_request', '0009_stockrequest_date_default_rejection_reason'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='issue_register' AND column_name='request_code'
                    ) THEN
                        ALTER TABLE issue_register
                        ADD COLUMN request_code VARCHAR(20) NULL DEFAULT NULL;
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='issue_register' AND column_name='stock_request_db_id'
                    ) THEN
                        ALTER TABLE issue_register
                        ADD COLUMN stock_request_db_id INTEGER NULL DEFAULT NULL;
                    END IF;
                END
                $$;
            """,
            reverse_sql="""
                ALTER TABLE issue_register
                DROP COLUMN IF EXISTS request_code;
                ALTER TABLE issue_register
                DROP COLUMN IF EXISTS stock_request_db_id;
            """,
        ),
    ]
