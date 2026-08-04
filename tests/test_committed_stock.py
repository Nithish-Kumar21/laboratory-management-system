import pytest
from decimal import Decimal
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.utils import timezone
from inventory.models import AvailableChemical
from stock_request.models import StockRequest

CHEM = "Committed Test Chemical"
CLASS_NAME = "I B.Sc Chemistry"

pytestmark = pytest.mark.django_db


def _second_staff_client():
    """Independent staff user so two requests can be pending simultaneously."""
    User = get_user_model()
    staff = User.objects.create_user(
        employee_id='staff_committed_2', email='staff_committed_2@test.com', password='test123',
        role='staff', full_name='Staff Committed 2', phone='+919999999994',
        designation='Staff', department='B.Sc Chemistry'
    )
    token = str(RefreshToken.for_user(staff).access_token)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


class TestCommittedQuantityTracking:
    """HOD accept() commits the promised quantity; issue releases it."""

    def _create_chemical(self, qty='1000.00'):
        return AvailableChemical.objects.create(
            chemical_name=CHEM, quantity=Decimal(qty),
            reorder_level=Decimal('50.00'), unit='ml'
        )

    def _create_request(self, client, qty):
        resp = client.post('/api/stock_request/', {
            'class_name': CLASS_NAME,
            'reason': 'Committed stock test',
            'status': 'pending',
            'date': timezone.now().date().isoformat(),
            'day_order': 'I',
            'hour': [1],
            'purpose_type': 'practical_lab',
            'experiment_name': 'Committed experiment',
            'chemical_items': [{'chemical_name': CHEM, 'quantity': str(qty)}],
        }, format='json')
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        return resp.data['id']

    def test_accept_commits_promised_quantity(self, auth_staff, auth_hod):
        """accept() must commit the promised qty without touching physical stock."""
        self._create_chemical()
        req_id = self._create_request(auth_staff, '400.00')

        resp = auth_hod.post(f'/api/stock_request/{req_id}/accept/')
        assert resp.status_code == status.HTTP_200_OK

        chem = AvailableChemical.objects.get(chemical_name=CHEM)
        assert chem.quantity == Decimal('1000.00')
        assert chem.committed_quantity_ml == Decimal('400.00')

    def test_accept_rejects_when_requested_exceeds_remaining(self, auth_staff, auth_hod):
        """A request <= physical stock but > remaining (other commitments) is rejected at accept."""
        chem = self._create_chemical()
        chem.committed_quantity_ml = Decimal('400.00')
        chem.save()
        req_id = self._create_request(auth_staff, '700.00')

        resp = auth_hod.post(f'/api/stock_request/{req_id}/accept/')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Insufficient stock' in resp.data['error']
        assert '600' in resp.data['error']

        req = StockRequest.objects.get(id=req_id)
        assert req.status == 'pending'
        chem.refresh_from_db()
        assert chem.committed_quantity_ml == Decimal('400.00')

    def test_mark_as_issued_decrements_physical_and_releases_commitment(self, auth_staff, auth_hod, auth_store_keeper):
        """Issue must decrement physical stock and free the commitment."""
        self._create_chemical()
        req_id = self._create_request(auth_staff, '400.00')

        resp = auth_hod.post(f'/api/stock_request/{req_id}/accept/')
        assert resp.status_code == status.HTTP_200_OK
        assert AvailableChemical.objects.get(chemical_name=CHEM).committed_quantity_ml == Decimal('400.00')

        resp = auth_store_keeper.post(f'/api/stock_request/{req_id}/mark_as_issued/')
        assert resp.status_code == status.HTTP_200_OK

        chem = AvailableChemical.objects.get(chemical_name=CHEM)
        assert chem.quantity == Decimal('600.00')
        assert chem.committed_quantity_ml == Decimal('0.00')

    def test_two_requests_cannot_overcommit_same_chemical(self, auth_staff, auth_hod):
        """R1 400ml accepted; R2 800ml must be blocked — only 600ml remains."""
        self._create_chemical()
        req1 = self._create_request(auth_staff, '400.00')

        r1 = auth_hod.post(f'/api/stock_request/{req1}/accept/')
        assert r1.status_code == status.HTTP_200_OK

        client2 = _second_staff_client()
        req2 = self._create_request(client2, '800.00')

        r2 = auth_hod.post(f'/api/stock_request/{req2}/accept/')
        assert r2.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Insufficient stock' in r2.data['error']
        # Validation must be against remaining (600), not raw physical (1000).
        assert '600' in r2.data['error']

        assert StockRequest.objects.get(id=req2).status == 'pending'
        chem = AvailableChemical.objects.get(chemical_name=CHEM)
        assert chem.committed_quantity_ml == Decimal('400.00')

    def test_hod_adjustment_commits_adjusted_quantity(self, auth_staff, auth_hod):
        """HOD-adjusted quantity is what gets committed."""
        self._create_chemical()
        req_id = self._create_request(auth_staff, '400.00')
        item_id = StockRequest.objects.get(id=req_id).chemical_items.first().id

        resp = auth_hod.post(f'/api/stock_request/{req_id}/accept/', {
            'chemical_items': [{'chemical_item_id': item_id, 'quantity_ml': '150.00'}],
        }, format='json')
        assert resp.status_code == status.HTTP_200_OK

        chem = AvailableChemical.objects.get(chemical_name=CHEM)
        assert chem.committed_quantity_ml == Decimal('150.00')


class TestAvailableChemicalRemainingField:
    """Serializer exposes remaining = quantity - committed_quantity_ml."""

    def _create_chemical(self, qty='1000.00', committed='400.00'):
        return AvailableChemical.objects.create(
            chemical_name='Remaining Chemical', quantity=Decimal(qty),
            committed_quantity_ml=Decimal(committed),
            reorder_level=Decimal('50.00'), unit='ml'
        )

    @staticmethod
    def _rows(data):
        return data['results'] if isinstance(data, dict) else data

    def test_hod_keeps_raw_quantity_and_adds_remaining(self, auth_hod):
        self._create_chemical()
        resp = auth_hod.get('/api/available_chemicals/')
        assert resp.status_code == status.HTTP_200_OK
        chem = next(c for c in self._rows(resp.data) if c['chemical_name'] == 'Remaining Chemical')
        assert Decimal(chem['quantity']) == Decimal('1000.00')
        assert Decimal(chem['remaining']) == Decimal('600.00')

    def test_staff_quantity_reflects_remaining(self, auth_staff):
        self._create_chemical()
        resp = auth_staff.get('/api/available_chemicals/')
        assert resp.status_code == status.HTTP_200_OK
        chem = next(c for c in self._rows(resp.data) if c['chemical_name'] == 'Remaining Chemical')
        assert Decimal(chem['quantity']) == Decimal('600.00')
        assert Decimal(chem['remaining']) == Decimal('600.00')
