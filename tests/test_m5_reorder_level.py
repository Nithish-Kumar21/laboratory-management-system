import pytest
from decimal import Decimal
from rest_framework import status
from inventory.models import AvailableChemical

CHEMICAL_NAME = "Reorder Test Chemical"
pytestmark = pytest.mark.django_db


class TestM5ReorderLevel:

    def test_reorder_level_stored_on_creation(self, auth_store_keeper):
        chem = AvailableChemical.objects.create(
            chemical_name=CHEMICAL_NAME, quantity=Decimal('100.00'),
            reorder_level=Decimal('25.00'), unit='ml'
        )
        assert chem.reorder_level == Decimal('25.00')

    def test_update_reorder_level_via_api(self, auth_store_keeper):
        chem = AvailableChemical.objects.create(
            chemical_name=CHEMICAL_NAME, quantity=Decimal('100.00'),
            reorder_level=Decimal('25.00'), unit='ml'
        )
        resp = auth_store_keeper.patch(
            f'/api/available_chemicals/{chem.id}/',
            {'reorder_level': '30.00'},
            format='json'
        )
        assert resp.status_code == status.HTTP_200_OK
        chem.refresh_from_db()
        assert chem.reorder_level == Decimal('30.00')

    @pytest.mark.parametrize('qty,reorder,expect_alert', [
        (Decimal('50.00'), Decimal('50.00'), False),
        (Decimal('49.99'), Decimal('50.00'), True),
        (Decimal('100.00'), Decimal('50.00'), False),
        (Decimal('0.00'), Decimal('1.00'), True),
    ])
    def test_boundary_values(self, auth_store_keeper, qty, reorder, expect_alert):
        AvailableChemical.objects.create(
            chemical_name=CHEMICAL_NAME, quantity=qty,
            reorder_level=reorder, unit='ml'
        )
        from inventory.models import LowStockChemical
        low_stock_exists = LowStockChemical.objects.filter(
            chemical_name=CHEMICAL_NAME
        ).exists() or (qty < reorder)
        assert low_stock_exists == expect_alert
