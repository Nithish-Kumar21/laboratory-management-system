import pytest
from decimal import Decimal
from rest_framework import status
from inventory.models import AvailableChemical, LowStockChemical

CHEMICAL_NAME = "Low Stock Chemical"
pytestmark = pytest.mark.django_db


class TestM4LowStockAlert:

    def test_low_stock_endpoint_accessible(self, auth_store_keeper):
        resp = auth_store_keeper.get('/api/low_stock_chemicals/')
        assert resp.status_code == status.HTTP_200_OK

    def test_low_stock_record_exists_after_below_reorder(self, auth_store_keeper):
        chem = AvailableChemical.objects.create(
            chemical_name=CHEMICAL_NAME, quantity=Decimal('10.00'),
            reorder_level=Decimal('50.00'), unit='ml'
        )
        LowStockChemical.objects.create(
            chemical_name=CHEMICAL_NAME, quantity=Decimal('10.00'),
            reorder_level=Decimal('50.00'), last_checked='2026-06-26'
        )
        resp = auth_store_keeper.get('/api/low_stock_chemicals/')
        assert resp.status_code == status.HTTP_200_OK
        names = [c['chemical_name'] for c in resp.data.get('results', resp.data)]
        assert CHEMICAL_NAME in names

    def test_no_alert_when_above_reorder_level(self, auth_store_keeper):
        AvailableChemical.objects.create(
            chemical_name=CHEMICAL_NAME, quantity=Decimal('100.00'),
            reorder_level=Decimal('50.00'), unit='ml'
        )
        resp = auth_store_keeper.get('/api/low_stock_chemicals/')
        assert resp.status_code == status.HTTP_200_OK
        names = [c['chemical_name'] for c in resp.data.get('results', resp.data)]
        assert CHEMICAL_NAME not in names
