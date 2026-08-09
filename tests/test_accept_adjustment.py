import pytest
from decimal import Decimal
from rest_framework import status
from django.utils import timezone
from inventory.models import AvailableChemical
from stock_request.models import StockRequest, StockRequestChemicalItem, IssueRegister, IssueChemicals
from audit.models import AuditLog

CHEM_A = "Adjustment Acid"
CHEM_B = "Adjustment Base"
CLASS_NAME = "I B.Sc Chemistry"

pytestmark = pytest.mark.django_db


class TestAcceptQuantityAdjustment:

    def _create_chemical(self, name=CHEM_A, qty='500.00'):
        return AvailableChemical.objects.create(
            chemical_name=name, quantity=Decimal(qty),
            reorder_level=Decimal('50.00'), unit='ml'
        )

    def _create_request(self, staff_client, items):
        resp = staff_client.post('/api/stock_request/', {
            'class_name': CLASS_NAME,
            'reason': 'Test accept adjustment',
            'status': 'pending',
            'date': timezone.now().date().isoformat(),
            'day_order': 'I',
            'hour': [1],
            'purpose_type': 'practical_lab',
            'experiment_name': 'Adjustment experiment',
            'chemical_items': items,
        }, format='json')
        assert resp.status_code == 201
        return resp.data['id']

    def test_accept_without_payload_is_unchanged_regression(self, auth_staff, auth_hod):
        """Accept with no body must behave exactly as before — no adjustment."""
        self._create_chemical()
        req_id = self._create_request(auth_staff, [
            {'chemical_name': CHEM_A, 'quantity': '100.00'},
        ])

        resp = auth_hod.post(f'/api/stock_request/{req_id}/accept/')
        assert resp.status_code == status.HTTP_200_OK

        req = StockRequest.objects.get(id=req_id)
        assert req.status == 'accepted'
        item = req.chemical_items.first()
        assert item.quantity == Decimal('100.00')
        assert item.unit == 'ml'

    def test_accept_with_valid_adjustment(self, auth_staff, auth_hod):
        """Accept with a valid lower quantity updates quantity_ml and status."""
        self._create_chemical()
        req_id = self._create_request(auth_staff, [
            {'chemical_name': CHEM_A, 'quantity': '100.00'},
        ])
        item_id = StockRequest.objects.get(id=req_id).chemical_items.first().id

        resp = auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
            'chemical_items': [{'chemical_item_id': item_id, 'quantity_ml': '75.00'}],
        }, format='json')
        assert resp.status_code == status.HTTP_200_OK

        req = StockRequest.objects.get(id=req_id)
        assert req.status == 'accepted'
        assert req.chemical_items.get(id=item_id).quantity == Decimal('75.00')

    def test_accept_adjustment_exceeding_stock_rejected_full_rollback(self, auth_staff, auth_hod):
        """Adjustment above available stock → 400, no partial update, status stays pending."""
        self._create_chemical(qty='500.00')
        req_id = self._create_request(auth_staff, [
            {'chemical_name': CHEM_A, 'quantity': '100.00'},
        ])
        item_id = StockRequest.objects.get(id=req_id).chemical_items.first().id

        resp = auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
            'chemical_items': [{'chemical_item_id': item_id, 'quantity_ml': '600.00'}],
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Insufficient stock' in resp.data['error']
        assert CHEM_A in resp.data['error']
        assert '500' in resp.data['error']

        req = StockRequest.objects.get(id=req_id)
        assert req.status == 'pending'
        assert req.chemical_items.get(id=item_id).quantity == Decimal('100.00')

    def test_accept_multiple_items_partial_payload(self, auth_staff, auth_hod):
        """Items not present in the payload are left unchanged."""
        self._create_chemical(CHEM_A)
        self._create_chemical(CHEM_B)
        req_id = self._create_request(auth_staff, [
            {'chemical_name': CHEM_A, 'quantity': '100.00'},
            {'chemical_name': CHEM_B, 'quantity': '50.00'},
        ])
        item_a = StockRequestChemicalItem.objects.get(stock_request_id=req_id, chemical_name=CHEM_A)
        item_b = StockRequestChemicalItem.objects.get(stock_request_id=req_id, chemical_name=CHEM_B)

        resp = auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
            'chemical_items': [{'chemical_item_id': item_a.id, 'quantity_ml': '40.00'}],
        }, format='json')
        assert resp.status_code == status.HTTP_200_OK

        item_a.refresh_from_db()
        item_b.refresh_from_db()
        assert item_a.quantity == Decimal('40.00')
        assert item_b.quantity == Decimal('50.00')

    def test_accept_invalid_item_id_rejected(self, auth_staff, auth_hod):
        self._create_chemical()
        req_id = self._create_request(auth_staff, [
            {'chemical_name': CHEM_A, 'quantity': '100.00'},
        ])

        resp = auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
            'chemical_items': [{'chemical_item_id': 999999, 'quantity_ml': '50.00'}],
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert StockRequest.objects.get(id=req_id).status == 'pending'

    def test_accept_non_positive_quantity_rejected(self, auth_staff, auth_hod):
        self._create_chemical()
        req_id = self._create_request(auth_staff, [
            {'chemical_name': CHEM_A, 'quantity': '100.00'},
        ])
        item_id = StockRequest.objects.get(id=req_id).chemical_items.first().id

        for bad_qty in ['0', '-5']:
            resp = auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
                'chemical_items': [{'chemical_item_id': item_id, 'quantity_ml': bad_qty}],
            }, format='json')
            assert resp.status_code == status.HTTP_400_BAD_REQUEST
            assert StockRequest.objects.get(id=req_id).status == 'pending'

    def test_accept_chemical_missing_from_inventory_rejected(self, auth_staff, auth_hod):
        """A requested chemical no longer in inventory blocks accept."""
        req_id = self._create_request(auth_staff, [
            {'chemical_name': 'Ghost Chemical', 'quantity': '100.00'},
        ])
        item_id = StockRequest.objects.get(id=req_id).chemical_items.first().id

        resp = auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
            'chemical_items': [{'chemical_item_id': item_id, 'quantity_ml': '50.00'}],
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'not found' in resp.data['error'].lower()

    def test_audit_log_shows_old_to_new(self, auth_staff, auth_hod, hod_user):
        self._create_chemical()
        req_id = self._create_request(auth_staff, [
            {'chemical_name': CHEM_A, 'quantity': '100.00'},
        ])
        item_id = StockRequest.objects.get(id=req_id).chemical_items.first().id

        auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
            'chemical_items': [{'chemical_item_id': item_id, 'quantity_ml': '75.00'}],
            'hod_remarks': 'Reduced due to limited stock',
        }, format='json')

        req = StockRequest.objects.get(id=req_id)
        entry = AuditLog.objects.get(
            action='REQUEST_ACCEPTED', entity_id=str(req.id)
        )
        assert f'{CHEM_A}: 100ml → 75ml' in entry.description
        assert 'Reduced due to limited stock' in entry.description
        assert entry.user_id == hod_user.id

    def test_double_accept_idempotent_no_readjustment(self, auth_staff, auth_hod):
        """Second accept call short-circuits; the second payload is not applied."""
        self._create_chemical()
        req_id = self._create_request(auth_staff, [
            {'chemical_name': CHEM_A, 'quantity': '100.00'},
        ])
        item_id = StockRequest.objects.get(id=req_id).chemical_items.first().id

        r1 = auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
            'chemical_items': [{'chemical_item_id': item_id, 'quantity_ml': '75.00'}],
        }, format='json')
        assert r1.status_code == status.HTTP_200_OK

        r2 = auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
            'chemical_items': [{'chemical_item_id': item_id, 'quantity_ml': '10.00'}],
        }, format='json')
        assert r2.status_code == status.HTTP_200_OK
        assert r2.data['data']['message'] == 'Already accepted.'
        assert StockRequestChemicalItem.objects.get(id=item_id).quantity == Decimal('75.00')

    def test_issue_uses_adjusted_quantity(self, auth_staff, auth_hod, auth_store_keeper):
        """mark_as_issued decrements inventory by the adjusted quantity."""
        chem = self._create_chemical(qty='500.00')
        req_id = self._create_request(auth_staff, [
            {'chemical_name': CHEM_A, 'quantity': '100.00'},
        ])
        item_id = StockRequest.objects.get(id=req_id).chemical_items.first().id

        auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
            'chemical_items': [{'chemical_item_id': item_id, 'quantity_ml': '75.00'}],
        }, format='json')

        resp = auth_store_keeper.post(f'/api/stock_request/{req_id}/mark_as_issued/')
        assert resp.status_code == status.HTTP_200_OK

        chem.refresh_from_db()
        assert chem.quantity == Decimal('425.00')

    def test_complete_issue_register_uses_adjusted_quantity(self, auth_staff, auth_hod, auth_store_keeper):
        """Adjusted quantity flows through to issue register at completion."""
        self._create_chemical(qty='500.00')
        req_id = self._create_request(auth_staff, [
            {'chemical_name': CHEM_A, 'quantity': '100.00'},
        ])
        item_id = StockRequest.objects.get(id=req_id).chemical_items.first().id

        auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
            'chemical_items': [{'chemical_item_id': item_id, 'quantity_ml': '75.00'}],
        }, format='json')
        auth_store_keeper.post(f'/api/stock_request/{req_id}/mark_as_issued/')
        auth_staff.post(f'/api/stock_request/{req_id}/report_usage/', {
            'items': [{'id': item_id, 'actual_used_quantity': '60.00'}],
        }, format='json')
        resp = auth_store_keeper.post(f'/api/stock_request/{req_id}/mark_as_completed/')
        assert resp.status_code == status.HTTP_200_OK

        ir = IssueRegister.objects.get(stock_request_db_id=req_id)
        ic = IssueChemicals.objects.get(ir=ir)
        assert ic.issued_quantity == Decimal('75.00')
