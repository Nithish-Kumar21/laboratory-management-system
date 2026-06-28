import pytest
from decimal import Decimal
from rest_framework import status
from inventory.models import AvailableChemical, AvailableApparatus
from stock_register.models import StockRegister

CHEMICAL_NAME = "Test Chemical A"
CHEMICAL_NAME2 = "Test Chemical B"
APPARATUS_NAME = "Test Apparatus A"
SUPPLIER = "Test Supplier"
INVOICE = "INV-M1-001"


class TestM1StockEntry:

    def _create_stock(self, client, data=None):
        if data is None:
            data = {
                'invoice_number': INVOICE,
                'date': '2026-06-26',
                'supplier_name': SUPPLIER,
                'remarks': 'M1 test entry',
                'chemical_items': [
                    {'chemical_name': CHEMICAL_NAME, 'make': 'Merck', 'quantity': '500.00', 'rate': '850.00'},
                ],
                'apparatus_items': [
                    {'apparatus_name': APPARATUS_NAME, 'make': 'Borosil', 'quantity_pieces': 10, 'rate': '150.00'},
                ],
            }
        return client.post('/api/stock_register/', data, format='json')

    def test_new_chemical_increases_inventory(self, auth_store_keeper, today):
        resp = self._create_stock(auth_store_keeper)
        assert resp.status_code == status.HTTP_201_CREATED
        chem = AvailableChemical.objects.get(chemical_name=CHEMICAL_NAME)
        assert chem.quantity == Decimal('500.00')

    def test_existing_chemical_topup(self, auth_store_keeper, today):
        AvailableChemical.objects.create(chemical_name=CHEMICAL_NAME, quantity=Decimal('200.00'), unit='ml')
        resp = self._create_stock(auth_store_keeper)
        assert resp.status_code == status.HTTP_201_CREATED
        chem = AvailableChemical.objects.get(chemical_name=CHEMICAL_NAME)
        assert chem.quantity == Decimal('700.00')

    def test_new_apparatus_increases_inventory(self, auth_store_keeper, today):
        resp = self._create_stock(auth_store_keeper)
        assert resp.status_code == status.HTTP_201_CREATED
        app = AvailableApparatus.objects.get(apparatus_name=APPARATUS_NAME)
        assert app.available_quantity_pieces == 10

    def test_existing_apparatus_topup(self, auth_store_keeper, today):
        AvailableApparatus.objects.create(apparatus_name=APPARATUS_NAME, available_quantity_pieces=5)
        resp = self._create_stock(auth_store_keeper)
        assert resp.status_code == status.HTTP_201_CREATED
        app = AvailableApparatus.objects.get(apparatus_name=APPARATUS_NAME)
        assert app.available_quantity_pieces == 15

    def test_multiple_entries_accumulate(self, auth_store_keeper, today):
        self._create_stock(auth_store_keeper)
        resp2 = auth_store_keeper.post('/api/stock_register/', {
            'invoice_number': 'INV-M1-002',
            'date': '2026-06-26',
            'supplier_name': SUPPLIER,
            'chemical_items': [
                {'chemical_name': CHEMICAL_NAME, 'make': 'Merck', 'quantity': '300.00', 'rate': '850.00'},
            ],
        }, format='json')
        assert resp2.status_code == status.HTTP_201_CREATED
        chem = AvailableChemical.objects.get(chemical_name=CHEMICAL_NAME)
        assert chem.quantity == Decimal('800.00')

    def test_stock_register_record_persisted(self, auth_store_keeper, today):
        resp = self._create_stock(auth_store_keeper)
        assert resp.status_code == status.HTTP_201_CREATED
        assert StockRegister.objects.count() == 1
        sr = StockRegister.objects.first()
        assert sr.invoice_number == INVOICE
        assert sr.supplier_name == SUPPLIER
        assert sr.chemical_items.count() == 1
        assert sr.apparatus_items.count() == 1

    def test_chemical_only_no_apparatus(self, auth_store_keeper, today):
        resp = auth_store_keeper.post('/api/stock_register/', {
            'invoice_number': 'INV-M1-003',
            'date': '2026-06-26',
            'supplier_name': SUPPLIER,
            'chemical_items': [
                {'chemical_name': CHEMICAL_NAME2, 'make': 'SRL', 'quantity': '100.00', 'rate': '200.00'},
            ],
        }, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        assert AvailableChemical.objects.get(chemical_name=CHEMICAL_NAME2).quantity == Decimal('100.00')

    def test_no_items_returns_error(self, auth_store_keeper, today):
        resp = auth_store_keeper.post('/api/stock_register/', {
            'invoice_number': 'INV-M1-004',
            'date': '2026-06-26',
            'supplier_name': SUPPLIER,
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_duplicate_invoice_error(self, auth_store_keeper, today):
        self._create_stock(auth_store_keeper)
        resp = self._create_stock(auth_store_keeper)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_store_keeper_only(self, auth_hod, auth_staff, auth_store_keeper):
        resp_hod = auth_hod.post('/api/stock_register/', {}, format='json')
        assert resp_hod.status_code == status.HTTP_403_FORBIDDEN
        resp_staff = auth_staff.post('/api/stock_register/', {}, format='json')
        assert resp_staff.status_code == status.HTTP_403_FORBIDDEN
        resp_sk = auth_store_keeper.get('/api/stock_register/')
        assert resp_sk.status_code == status.HTTP_200_OK
