import pytest
from decimal import Decimal
from rest_framework import status
from django.utils import timezone
from inventory.models import AvailableChemical
from stock_request.models import StockRequest, StockRequestChemicalItem

CHEM_NAME = "Idempotency Acid"
CLASS_NAME = "I B.Sc Chemistry"
REASON = "Test idempotency"

pytestmark = pytest.mark.django_db


class TestIdempotency:

    def _create_chemical(self):
        AvailableChemical.objects.create(
            chemical_name=CHEM_NAME, quantity=Decimal('500.00'),
            reorder_level=Decimal('50.00'), unit='ml'
        )

    def _create_draft(self, staff_client):
        resp = staff_client.post('/api/stock_request/', {
            'class_name': CLASS_NAME,
            'reason': REASON,
            'status': 'draft',
            'date': timezone.now().date().isoformat(),
            'chemical_items': [
                {'chemical_name': CHEM_NAME, 'quantity': '100.00'},
            ],
        }, format='json')
        assert resp.status_code == 201
        return resp.data['id']

    def test_submit_idempotent(self, auth_staff):
        self._create_chemical()
        req_id = self._create_draft(auth_staff)

        r1 = auth_staff.post(f'/api/stock_request/{req_id}/submit/')
        assert r1.status_code == 200
        assert StockRequest.objects.get(id=req_id).status == 'pending'

        r2 = auth_staff.post(f'/api/stock_request/{req_id}/submit/')
        assert r2.status_code == 200
        assert r2.data['data']['message'] == 'Already submitted.'
        assert StockRequest.objects.get(id=req_id).status == 'pending'

    def test_cancel_idempotent(self, auth_staff):
        self._create_chemical()
        req_id = self._create_draft(auth_staff)
        auth_staff.post(f'/api/stock_request/{req_id}/submit/')

        r1 = auth_staff.post(f'/api/stock_request/{req_id}/cancel/')
        assert r1.status_code == 200
        assert StockRequest.objects.get(id=req_id).status == 'cancelled'

        r2 = auth_staff.post(f'/api/stock_request/{req_id}/cancel/')
        assert r2.status_code == 200
        assert r2.data['data']['message'] == 'Already cancelled.'
        assert StockRequest.objects.get(id=req_id).status == 'cancelled'

    def test_accept_idempotent(self, auth_staff, auth_hod):
        self._create_chemical()
        req_id = self._create_draft(auth_staff)
        auth_staff.post(f'/api/stock_request/{req_id}/submit/')

        r1 = auth_hod.post(f'/api/stock_request/{req_id}/accept/')
        assert r1.status_code == 200
        assert StockRequest.objects.get(id=req_id).status == 'accepted'

        r2 = auth_hod.post(f'/api/stock_request/{req_id}/accept/')
        assert r2.status_code == 200
        assert r2.data['data']['message'] == 'Already accepted.'
        assert StockRequest.objects.get(id=req_id).status == 'accepted'

    def test_reject_idempotent(self, auth_staff, auth_hod):
        self._create_chemical()
        req_id = self._create_draft(auth_staff)
        auth_staff.post(f'/api/stock_request/{req_id}/submit/')

        r1 = auth_hod.post(f'/api/stock_request/{req_id}/reject/', {'rejection_reason': 'Not enough justification.'}, format='json')
        assert r1.status_code == 200
        assert StockRequest.objects.get(id=req_id).status == 'rejected'

        r2 = auth_hod.post(f'/api/stock_request/{req_id}/reject/', {'rejection_reason': 'Not enough justification.'}, format='json')
        assert r2.status_code == 200
        assert r2.data['data']['message'] == 'Already rejected.'
        assert StockRequest.objects.get(id=req_id).status == 'rejected'

    def test_issue_idempotent_inventory_decremented_once(self, auth_staff, auth_hod, auth_store_keeper):
        self._create_chemical()
        req_id = self._create_draft(auth_staff)
        auth_staff.post(f'/api/stock_request/{req_id}/submit/')
        auth_hod.post(f'/api/stock_request/{req_id}/accept/')

        r1 = auth_store_keeper.post(f'/api/stock_request/{req_id}/mark_as_issued/')
        assert r1.status_code == 200
        assert StockRequest.objects.get(id=req_id).status == 'issued'
        assert AvailableChemical.objects.get(chemical_name=CHEM_NAME).quantity == Decimal('400.00')

        r2 = auth_store_keeper.post(f'/api/stock_request/{req_id}/mark_as_issued/')
        assert r2.status_code == 200
        assert r2.data['data']['message'] == 'Already issued.'

        chem = AvailableChemical.objects.get(chemical_name=CHEM_NAME)
        assert chem.quantity == Decimal('400.00'), f'Expected 400.00, got {chem.quantity}'

    def test_report_usage_idempotent(self, auth_staff, auth_hod, auth_store_keeper):
        self._create_chemical()
        req_id = self._create_draft(auth_staff)
        auth_staff.post(f'/api/stock_request/{req_id}/submit/')
        auth_hod.post(f'/api/stock_request/{req_id}/accept/')
        auth_store_keeper.post(f'/api/stock_request/{req_id}/mark_as_issued/')

        chem_item = StockRequest.objects.get(id=req_id).chemical_items.first()

        r1 = auth_staff.post(f'/api/stock_request/{req_id}/report_usage/', {
            'items': [{'id': chem_item.id, 'actual_used_quantity': '70.00'}],
        }, format='json')
        assert r1.status_code == 200
        assert StockRequest.objects.get(id=req_id).status == 'reported'

        r2 = auth_staff.post(f'/api/stock_request/{req_id}/report_usage/', {
            'items': [{'id': chem_item.id, 'actual_used_quantity': '70.00'}],
        }, format='json')
        assert r2.status_code == 200
        assert r2.data['data']['message'] == 'Usage already reported.'
        assert StockRequest.objects.get(id=req_id).status == 'reported'

    def test_complete_idempotent_inventory_incremented_once(self, auth_staff, auth_hod, auth_store_keeper):
        self._create_chemical()
        req_id = self._create_draft(auth_staff)
        auth_staff.post(f'/api/stock_request/{req_id}/submit/')
        auth_hod.post(f'/api/stock_request/{req_id}/accept/')
        auth_store_keeper.post(f'/api/stock_request/{req_id}/mark_as_issued/')

        chem_item = StockRequest.objects.get(id=req_id).chemical_items.first()
        auth_staff.post(f'/api/stock_request/{req_id}/report_usage/', {
            'items': [{'id': chem_item.id, 'actual_used_quantity': '70.00'}],
        }, format='json')

        r1 = auth_store_keeper.post(f'/api/stock_request/{req_id}/mark_as_completed/')
        assert r1.status_code == 200
        assert StockRequest.objects.get(id=req_id).status == 'completed'

        r2 = auth_store_keeper.post(f'/api/stock_request/{req_id}/mark_as_completed/')
        assert r2.status_code == 200
        assert r2.data['data']['message'] == 'Already completed.'

        chem = AvailableChemical.objects.get(chemical_name=CHEM_NAME)
        assert chem.quantity == Decimal('430.00'), f'Expected 430.00, got {chem.quantity}'
