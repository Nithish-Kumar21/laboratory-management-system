from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('stock_request', '0011_alter_stockrequest_rejection_reason_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS issue_register (
                    ir_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_code VARCHAR(20) NULL,
                    stock_request_db_id INTEGER NULL,
                    staff_name VARCHAR(100) NOT NULL,
                    class VARCHAR(50) NOT NULL,
                    date DATE NOT NULL,
                    status VARCHAR(20) NOT NULL
                );

                CREATE TABLE IF NOT EXISTS issue_chemicals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ir_id INTEGER NOT NULL REFERENCES issue_register(ir_id),
                    chemical_name VARCHAR(64) NOT NULL,
                    issued_quantity DECIMAL(10,2) NOT NULL,
                    actual_usage DECIMAL(10,2) NULL
                );
            """,
            reverse_sql="""
                DROP TABLE IF EXISTS issue_chemicals;
                DROP TABLE IF EXISTS issue_register;
            """,
        ),
    ]
