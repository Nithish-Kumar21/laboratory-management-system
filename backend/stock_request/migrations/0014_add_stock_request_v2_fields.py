import django.contrib.postgres.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stock_request', '0013_alter_stockrequest_options_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE stock_request
                    ADD COLUMN IF NOT EXISTS day_order VARCHAR(5) NOT NULL DEFAULT 'I',
                    ADD COLUMN IF NOT EXISTS hour INTEGER[] NOT NULL DEFAULT '{}',
                    ADD COLUMN IF NOT EXISTS purpose_type VARCHAR(20) NOT NULL DEFAULT 'practical_lab',
                    ADD COLUMN IF NOT EXISTS experiment_name TEXT NOT NULL DEFAULT '',
                    ADD COLUMN IF NOT EXISTS student_name VARCHAR(100) NULL;
            """,
            reverse_sql="""
                ALTER TABLE stock_request
                    DROP COLUMN IF EXISTS day_order,
                    DROP COLUMN IF EXISTS hour,
                    DROP COLUMN IF EXISTS purpose_type,
                    DROP COLUMN IF EXISTS experiment_name,
                    DROP COLUMN IF EXISTS student_name;
            """,
            state_operations=[
                migrations.AddField(
                    model_name='stockrequest',
                    name='day_order',
                    field=models.CharField(choices=[('I', 'I'), ('II', 'II'), ('III', 'III'), ('IV', 'IV'), ('V', 'V'), ('VI', 'VI')], max_length=5),
                ),
                migrations.AddField(
                    model_name='stockrequest',
                    name='hour',
                    field=django.contrib.postgres.fields.ArrayField(size=None, base_field=models.IntegerField()),
                ),
                migrations.AddField(
                    model_name='stockrequest',
                    name='purpose_type',
                    field=models.CharField(choices=[('practical_lab', 'Practical Lab'), ('research_project', 'Research/Project')], max_length=20),
                ),
                migrations.AddField(
                    model_name='stockrequest',
                    name='experiment_name',
                    field=models.TextField(),
                ),
                migrations.AddField(
                    model_name='stockrequest',
                    name='student_name',
                    field=models.CharField(max_length=100, null=True, blank=True),
                ),
            ],
        ),
    ]
