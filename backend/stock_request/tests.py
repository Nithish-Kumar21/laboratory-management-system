from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal
from .models import StockRequest, StockRequestChemicalItem, IssueRegister, IssueChemicals
from inventory.models import AvailableChemical

User = get_user_model()


class UnitPropagationTest(APITestCase):
    """Verify unit propagates correctly from source chemical through the entire workflow."""

    def setUp(self):
        self.today = timezone.now().date()

        self.staff = User.objects.create_user(
            employee_id='staff_ut', email='staff_ut@test.com', password='password123',
            role='staff', full_name='Staff UT',
            phone='+919999999101', designation='Staff', department='B.Sc Chemistry'
        )
        self.hod = User.objects.create_user(
            employee_id='hod_ut', email='hod_ut@test.com', password='password123',
            role='hod', full_name='HOD UT',
            phone='+919999999102', designation='HOD', department='B.Sc Chemistry'
        )
        self.store_keeper = User.objects.create_user(
            employee_id='sk_ut', email='sk_ut@test.com', password='password123',
            role='store_keeper', full_name='Store Keeper UT',
            phone='+919999999103', designation='Store Keeper', department='B.Sc Chemistry'
        )

        self.chem_g = AvailableChemical.objects.create(
            chemical_name='Test Chemical (Powder)',
            quantity=Decimal('1000.00'),
            unit='g',
            last_updated=self.today,
        )
        self.chem_ml = AvailableChemical.objects.create(
            chemical_name='Test Chemical (Liquid)',
            quantity=Decimal('500.00'),
            unit='ml',
            last_updated=self.today,
        )

    def _login(self, user):
        resp = self.client.post('/api/users/login/', {
            'username': user.employee_id, 'password': 'password123'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def test_unit_propagates_to_stock_request_chemical_item(self):
        """Creating a stock request should copy unit from AvailableChemical."""
        self._login(self.staff)
        response = self.client.post('/api/stock_request/', {
            'class_name': 'I B.Sc Chemistry',
            'reason': 'Test unit propagation',
            'chemical_items': [
                {'chemical_name': self.chem_g.chemical_name, 'quantity': 100.00},
            ],
            'status': 'pending',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        req_id = response.data['id']
        item = StockRequestChemicalItem.objects.filter(stock_request_id=req_id).first()
        self.assertIsNotNone(item)
        self.assertEqual(item.unit, 'g')

    def test_unit_propagates_for_ml_chemical(self):
        """Creating a stock request for an ml chemical should set unit='ml'."""
        self._login(self.staff)
        response = self.client.post('/api/stock_request/', {
            'class_name': 'I B.Sc Chemistry',
            'reason': 'Test ml propagation',
            'chemical_items': [
                {'chemical_name': self.chem_ml.chemical_name, 'quantity': 50.00},
            ],
            'status': 'pending',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        item = StockRequestChemicalItem.objects.filter(stock_request_id=response.data['id']).first()
        self.assertEqual(item.unit, 'ml')

    def test_unit_propagates_to_issue_chemicals(self):
        """Full workflow: request → accept → issue → report → complete should propagate unit to issue_chemicals."""
        self._login(self.staff)
        response = self.client.post('/api/stock_request/', {
            'class_name': 'I B.Sc Chemistry',
            'reason': 'Test full propagation',
            'chemical_items': [
                {'chemical_name': self.chem_g.chemical_name, 'quantity': 100.00},
            ],
            'status': 'pending',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        req_id = response.data['id']

        stock_item = StockRequestChemicalItem.objects.filter(stock_request_id=req_id).first()
        self.assertEqual(stock_item.unit, 'g')

        self._login(self.hod)
        response = self.client.post(f'/api/stock_request/{req_id}/accept/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self._login(self.store_keeper)
        response = self.client.post(f'/api/stock_request/{req_id}/mark_as_issued/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self._login(self.staff)
        response = self.client.post(f'/api/stock_request/{req_id}/report_usage/', {
            'items': [{'id': stock_item.id, 'actual_used_quantity': 80.00}]
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self._login(self.store_keeper)
        response = self.client.post(f'/api/stock_request/{req_id}/mark_as_completed/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ir = IssueRegister.objects.filter(stock_request_db_id=req_id).first()
        self.assertIsNotNone(ir)
        ic = IssueChemicals.objects.filter(ir=ir).first()
        self.assertIsNotNone(ic)
        self.assertEqual(ic.unit, 'g')

    def test_api_response_includes_unit(self):
        """Serializer should return unit in API response."""
        self._login(self.staff)
        response = self.client.post('/api/stock_request/', {
            'class_name': 'I B.Sc Chemistry',
            'reason': 'Test API unit response',
            'chemical_items': [
                {'chemical_name': self.chem_g.chemical_name, 'quantity': 50.00},
            ],
            'status': 'pending',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        req_id = response.data['id']
        self._login(self.hod)
        response = self.client.get(f'/api/stock_request/{req_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        for item in response.data['chemical_items']:
            self.assertIn('unit', item)
            self.assertEqual(item['unit'], 'g')
