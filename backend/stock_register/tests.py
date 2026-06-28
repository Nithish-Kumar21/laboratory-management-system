from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal
from .models import StockRegister, ChemicalItem, ApparatusItem
from inventory.models import AvailableChemical, AvailableApparatus

User = get_user_model()


class StockRegisterWorkflowTest(APITestCase):
    def setUp(self):
        self.store_keeper = User.objects.create_user(
            employee_id='sk_test', email='sk@test.com', password='password123',
            role='store_keeper', full_name='Store Keeper',
            phone='+919999999991', designation='Store Keeper', department='B.Sc Chemistry'
        )
        self.hod = User.objects.create_user(
            employee_id='hod_test', email='hod@test.com', password='password123',
            role='hod', full_name='HOD User',
            phone='+919999999992', designation='HOD', department='B.Sc Chemistry'
        )
        self.staff = User.objects.create_user(
            employee_id='staff_test', email='staff@test.com', password='password123',
            role='staff', full_name='Staff User',
            phone='+919999999993', designation='Staff', department='B.Sc Chemistry'
        )
        self.admin = User.objects.create_user(
            employee_id='admin_test', email='admin@test.com', password='password123',
            role='admin', full_name='Admin User',
            phone='+919999999994', designation='Admin', department='B.Sc Chemistry'
        )
        self.today = timezone.now().date()
        self.valid_chemicals = [
            {'chemical_name': 'Sulfuric Acid', 'make': 'Merck', 'quantity': '500.00', 'rate': '850.00'},
            {'chemical_name': 'Hydrochloric Acid', 'make': 'SRL', 'quantity': '300.00', 'rate': '650.00'},
        ]
        self.valid_apparatus = [
            {'apparatus_name': 'Beaker 250ml', 'make': 'Borosil', 'quantity_pieces': 10, 'rate': '150.00'},
        ]

    def _login(self, user):
        resp = self.client.post('/api/users/login/', {
            'username': user.employee_id, 'password': 'password123'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def _create_sr(self, data=None):
        if data is None:
            data = {
                'invoice_number': 'INV-001',
                'date': self.today.isoformat(),
                'supplier_name': 'Test Supplier',
                'remarks': 'Test entry',
                'chemical_items': self.valid_chemicals,
                'apparatus_items': self.valid_apparatus,
            }
        return self.client.post('/api/stock_register/', data, format='json')

    def _get_results(self, response):
        return response.data.get('results', response.data)

    # ── CREATE ──────────────────────────────────────────────

    def test_store_keeper_can_create(self):
        self._login(self.store_keeper)
        r = self._create_sr()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(StockRegister.objects.count(), 1)
        sr = StockRegister.objects.first()
        self.assertEqual(sr.invoice_number, 'INV-001')
        self.assertEqual(sr.chemical_items.count(), 2)
        self.assertEqual(sr.apparatus_items.count(), 1)

    def test_create_updates_chemical_inventory(self):
        self._login(self.store_keeper)
        r = self._create_sr()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AvailableChemical.objects.get(chemical_name='Sulfuric Acid').quantity, Decimal('500.00'))
        self.assertEqual(AvailableChemical.objects.get(chemical_name='Hydrochloric Acid').quantity, Decimal('300.00'))

    def test_create_updates_apparatus_inventory(self):
        self._login(self.store_keeper)
        r = self._create_sr()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AvailableApparatus.objects.get(apparatus_name='Beaker 250ml').available_quantity_pieces, 10)

    def test_create_existing_chemical_adds(self):
        AvailableChemical.objects.create(chemical_name='Sulfuric Acid', quantity=Decimal('200.00'), unit='ml', last_updated=self.today)
        self._login(self.store_keeper)
        self._create_sr()
        self.assertEqual(AvailableChemical.objects.get(chemical_name='Sulfuric Acid').quantity, Decimal('700.00'))

    def test_create_existing_apparatus_adds(self):
        AvailableApparatus.objects.create(apparatus_name='Beaker 250ml', available_quantity_pieces=5)
        self._login(self.store_keeper)
        self._create_sr()
        self.assertEqual(AvailableApparatus.objects.get(apparatus_name='Beaker 250ml').available_quantity_pieces, 15)

    def test_create_no_chemicals(self):
        self._login(self.store_keeper)
        r = self._create_sr({'invoice_number': 'INV-002', 'date': self.today.isoformat(), 'supplier_name': 'S', 'apparatus_items': self.valid_apparatus})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(StockRegister.objects.first().chemical_items.count(), 0)
        self.assertEqual(StockRegister.objects.first().apparatus_items.count(), 1)

    def test_create_no_apparatus(self):
        self._login(self.store_keeper)
        r = self._create_sr({'invoice_number': 'INV-003', 'date': self.today.isoformat(), 'supplier_name': 'S', 'chemical_items': self.valid_chemicals})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(StockRegister.objects.first().chemical_items.count(), 2)

    def test_create_no_items_error(self):
        self._login(self.store_keeper)
        r = self._create_sr({'invoice_number': 'INV-004', 'date': self.today.isoformat(), 'supplier_name': 'S'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicate_invoice_error(self):
        self._login(self.store_keeper)
        self._create_sr()
        r = self._create_sr()
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_future_date_error(self):
        self._login(self.store_keeper)
        future = (self.today.replace(year=self.today.year + 1)).isoformat()
        r = self._create_sr({'invoice_number': 'INV-005', 'date': future, 'supplier_name': 'S', 'chemical_items': self.valid_chemicals})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_quantity_error(self):
        self._login(self.store_keeper)
        r = self._create_sr({'invoice_number': 'INV-ERR', 'date': self.today.isoformat(), 'supplier_name': 'S',
                             'chemical_items': [{'chemical_name': 'C', 'make': 'M', 'quantity': '-10', 'rate': '10'}]})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_rate_error(self):
        self._login(self.store_keeper)
        r = self._create_sr({'invoice_number': 'INV-ERR2', 'date': self.today.isoformat(), 'supplier_name': 'S',
                             'chemical_items': [{'chemical_name': 'C', 'make': 'M', 'quantity': '10', 'rate': '-5'}]})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_multiple_entries_accumulate(self):
        self._login(self.store_keeper)
        self._create_sr({'invoice_number': 'INV-A1', 'date': self.today.isoformat(), 'supplier_name': 'S',
                         'chemical_items': [{'chemical_name': 'Ethanol', 'make': 'M1', 'quantity': '1000', 'rate': '100'}]})
        self._create_sr({'invoice_number': 'INV-A2', 'date': self.today.isoformat(), 'supplier_name': 'S',
                         'chemical_items': [{'chemical_name': 'Ethanol', 'make': 'M1', 'quantity': '500', 'rate': '110'}]})
        self.assertEqual(AvailableChemical.objects.get(chemical_name='Ethanol').quantity, Decimal('1500.00'))

    def test_admin_can_create(self):
        self._login(self.admin)
        r = self._create_sr()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_hod_cannot_create(self):
        self._login(self.hod)
        r = self._create_sr({'invoice_number': 'INV-HOD', 'date': self.today.isoformat(), 'supplier_name': 'S',
                             'chemical_items': self.valid_chemicals})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_cannot_access(self):
        self._login(self.staff)
        self.assertEqual(self.client.get('/api/stock_register/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post('/api/stock_register/', {}, format='json').status_code, status.HTTP_403_FORBIDDEN)

    # ── LIST / DETAIL ───────────────────────────────────────

    def test_list_returns_item_counts(self):
        self._login(self.store_keeper)
        self._create_sr()
        r = self.client.get('/api/stock_register/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        results = self._get_results(r)
        self.assertEqual(len(results), 1)
        self.assertIn('chemical_items_count', results[0])
        self.assertIn('apparatus_items_count', results[0])
        self.assertEqual(results[0]['chemical_items_count'], 2)
        self.assertEqual(results[0]['apparatus_items_count'], 1)

    def test_hod_can_list(self):
        self._login(self.store_keeper)
        self._create_sr()
        self._login(self.hod)
        r = self.client.get('/api/stock_register/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._get_results(r)), 1)

    def test_detail_returns_nested_items(self):
        self._login(self.store_keeper)
        create_r = self._create_sr()
        sr_id = create_r.data['id']

        r = self.client.get(f'/api/stock_register/{sr_id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('chemical_items', r.data)
        self.assertIn('apparatus_items', r.data)
        self.assertEqual(len(r.data['chemical_items']), 2)
        self.assertEqual(len(r.data['apparatus_items']), 1)

    def test_ordering_by_date(self):
        self._login(self.store_keeper)
        self._create_sr({'invoice_number': 'INV-O1', 'date': '2024-01-01', 'supplier_name': 'A',
                         'chemical_items': [{'chemical_name': 'C1', 'make': 'M', 'quantity': '100', 'rate': '10'}]})
        self._create_sr({'invoice_number': 'INV-O2', 'date': '2024-06-01', 'supplier_name': 'B',
                         'chemical_items': [{'chemical_name': 'C2', 'make': 'M', 'quantity': '200', 'rate': '20'}]})
        r = self.client.get('/api/stock_register/?ordering=date')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        dates = [e['date'] for e in self._get_results(r)]
        self.assertEqual(dates, sorted(dates))

    # ── DELETE ──────────────────────────────────────────────

    def test_store_keeper_can_delete(self):
        self._login(self.store_keeper)
        create_r = self._create_sr()
        sr_id = create_r.data['id']

        r = self.client.delete(f'/api/stock_register/{sr_id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(StockRegister.objects.count(), 0)

    def test_delete_reverses_chemical_inventory(self):
        self._login(self.store_keeper)
        create_r = self._create_sr()
        sr_id = create_r.data['id']

        chem = AvailableChemical.objects.get(chemical_name='Sulfuric Acid')
        self.assertEqual(chem.quantity, Decimal('500.00'))

        self.client.delete(f'/api/stock_register/{sr_id}/')
        chem.refresh_from_db()
        self.assertEqual(chem.quantity, Decimal('0.00'))

    def test_delete_reverses_apparatus_inventory(self):
        self._login(self.store_keeper)
        create_r = self._create_sr()
        sr_id = create_r.data['id']

        app = AvailableApparatus.objects.get(apparatus_name='Beaker 250ml')
        self.assertEqual(app.available_quantity_pieces, 10)

        self.client.delete(f'/api/stock_register/{sr_id}/')
        app.refresh_from_db()
        self.assertEqual(app.available_quantity_pieces, 0)

    def test_admin_cannot_delete(self):
        self._login(self.store_keeper)
        create_r = self._create_sr()
        sr_id = create_r.data['id']

        self._login(self.admin)
        self.assertEqual(self.client.delete(f'/api/stock_register/{sr_id}/').status_code, status.HTTP_403_FORBIDDEN)

    def test_hod_cannot_delete(self):
        self._login(self.store_keeper)
        create_r = self._create_sr()
        sr_id = create_r.data['id']

        self._login(self.hod)
        self.assertEqual(self.client.delete(f'/api/stock_register/{sr_id}/').status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_cannot_delete(self):
        self._login(self.store_keeper)
        create_r = self._create_sr()
        sr_id = create_r.data['id']

        self._login(self.staff)
        self.assertEqual(self.client.delete(f'/api/stock_register/{sr_id}/').status_code, status.HTTP_403_FORBIDDEN)

    # ── AUTOCOMPLETE ENDPOINTS ──────────────────────────────

    def test_chemical_names(self):
        self._login(self.store_keeper)
        self._create_sr()
        r = self.client.get('/api/stock_register/chemical_names/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        names = [i['name'] for i in r.data]
        self.assertIn('Sulfuric Acid', names)
        self.assertIn('Hydrochloric Acid', names)

    def test_apparatus_names(self):
        self._login(self.store_keeper)
        self._create_sr()
        r = self.client.get('/api/stock_register/apparatus_names/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        names = [i['name'] for i in r.data]
        self.assertIn('Beaker 250ml', names)

    def test_supplier_names(self):
        self._login(self.store_keeper)
        self._create_sr()
        r = self.client.get('/api/stock_register/supplier_names/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('Test Supplier', r.data)

    def test_chemical_makes(self):
        self._login(self.store_keeper)
        self._create_sr()
        r = self.client.get('/api/stock_register/chemical_makes/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('Merck', r.data)
        self.assertIn('SRL', r.data)

    def test_apparatus_makes(self):
        self._login(self.store_keeper)
        self._create_sr()
        r = self.client.get('/api/stock_register/apparatus_makes/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('Borosil', r.data)
