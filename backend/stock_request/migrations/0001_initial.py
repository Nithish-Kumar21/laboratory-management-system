# Generated manually for stock_request app

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='StockRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('reason', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('requested_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stock_requests', to=settings.AUTH_USER_MODEL)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'stock_request',
                'managed': True,
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='StockRequestChemicalItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chemical_name', models.CharField(max_length=64)),
                ('quantity_ml', models.DecimalField(decimal_places=2, max_digits=10)),
                ('stock_request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chemical_items', to='stock_request.stockrequest')),
            ],
            options={
                'db_table': 'stock_request_chemical_item',
                'managed': True,
            },
        ),
        migrations.CreateModel(
            name='StockRequestApparatusItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('apparatus_name', models.CharField(max_length=64)),
                ('quantity_pieces', models.IntegerField()),
                ('stock_request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='apparatus_items', to='stock_request.stockrequest')),
            ],
            options={
                'db_table': 'stock_request_apparatus_item',
                'managed': True,
            },
        ),
    ]
