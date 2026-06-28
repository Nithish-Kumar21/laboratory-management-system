import pytest
from decimal import Decimal
from rest_framework import status
from django.utils import timezone
from inventory.models import AvailableChemical
from stock_request.models import StockRequest, StockRequestChemicalItem, IssueRegister, IssueChemicals

CHEMICAL_NAME = "Sulfuric Acid"
CHEMICAL_NAME_LOWER = "sulfuric acid"
APPARATUS_NAME = "Test Apparatus"
CLASS_NAME = "I B.Sc Chemistry"
REASON = "Lab experiment requirement"

pytestmark = pytest.mark.django_db


class TestM3E2EWorkflow:

    def _setup_inventory(self):
        AvailableChemical.objects.create(
            chemical_name=CHEMICAL_NAME, quantity=Decimal('1000.00'),
            reorder_level=Decimal('100.00'), unit='ml'
        )

    def _login_as(self, client, user, password='test123'):
        resp = client.post('/api/users/login/', {'username': user.employee_id, 'password': password})
        token = resp.data['access']
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return resp

    def _create_request(self, client, status_val='draft', chemical=None):
        if chemical is None:
            chemical = CHEMICAL_NAME
        return client.post('/api/stock_request/', {
            'class_name': CLASS_NAME,
            'reason': REASON,
            'status': status_val,
            'date': timezone.now().date().isoformat(),
            'chemical_items': [
                {'chemical_name': chemical, 'quantity': '200.00'},
            ],
        }, format='json')

    def test_full_workflow(self, api_client, hod_user, store_keeper_user, staff_user):
        self._setup_inventory()

        # 1. Staff creates draft request
        self._login_as(api_client, staff_user)
        create_resp = self._create_request(api_client, 'draft')
        assert create_resp.status_code == status.HTTP_201_CREATED
        req_id = create_resp.data['id']
        assert create_resp.data['status'] == 'draft'

        # 2. Staff submits the request
        submit_resp = api_client.post(f'/api/stock_request/{req_id}/submit/')
        assert submit_resp.status_code == status.HTTP_200_OK
        assert StockRequest.objects.get(id=req_id).status == 'pending'

        # 3. HOD approves
        self._login_as(api_client, hod_user)
        accept_resp = api_client.post(f'/api/stock_request/{req_id}/accept/')
        assert accept_resp.status_code == status.HTTP_200_OK
        assert StockRequest.objects.get(id=req_id).status == 'accepted'

        # 4. Storekeeper issues chemicals
        self._login_as(api_client, store_keeper_user)
        issue_resp = api_client.post(f'/api/stock_request/{req_id}/mark_as_issued/')
        assert issue_resp.status_code == status.HTTP_200_OK
        assert StockRequest.objects.get(id=req_id).status == 'issued'

        # 5. Verify inventory decremented at issue stage
        chem = AvailableChemical.objects.get(chemical_name=CHEMICAL_NAME)
        assert chem.quantity == Decimal('800.00')

        # 6. Staff reports usage
        self._login_as(api_client, staff_user)
        chem_item = StockRequest.objects.get(id=req_id).chemical_items.first()
        report_resp = api_client.post(f'/api/stock_request/{req_id}/report_usage/', {
            'items': [{'id': chem_item.id, 'actual_used_quantity': '150.00'}],
        }, format='json')
        assert report_resp.status_code == status.HTTP_200_OK
        assert StockRequest.objects.get(id=req_id).status == 'reported'

        # 7. Storekeeper completes
        self._login_as(api_client, store_keeper_user)
        complete_resp = api_client.post(f'/api/stock_request/{req_id}/mark_as_completed/')
        assert complete_resp.status_code == status.HTTP_200_OK
        assert StockRequest.objects.get(id=req_id).status == 'completed'

        # 8. Verify inventory is decremented by actual used quantity
        chem.refresh_from_db()
        assert chem.quantity == Decimal('850.00')

        # 9. Verify IssueRegister row created
        assert IssueRegister.objects.filter(request_code=create_resp.data['request_id']).exists()
        ir = IssueRegister.objects.get(request_code=create_resp.data['request_id'])
        assert ir.staff_name == staff_user.full_name
        assert ir.class_field == CLASS_NAME
        assert ir.status == 'completed'

        # 10. Verify IssueChemicals row created with correct data
        assert ir.chemicals.count() == 1
        ic = ir.chemicals.first()
        assert ic.chemical_name == CHEMICAL_NAME
        assert ic.issued_quantity == Decimal('200.00')
        assert ic.actual_usage == Decimal('150.00')

    def test_apparatus_in_request_rejected(self, api_client, staff_user):
        self._setup_inventory()
        self._login_as(api_client, staff_user)
        resp = api_client.post('/api/stock_request/', {
            'class_name': CLASS_NAME,
            'reason': REASON,
            'date': timezone.now().date().isoformat(),
            'chemical_items': [],
            'apparatus_items': [
                {'apparatus_name': APPARATUS_NAME, 'quantity_pieces': 5},
            ],
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_case_insensitive_chemical_name(self, api_client, staff_user, hod_user):
        self._setup_inventory()
        self._login_as(api_client, staff_user)
        resp = self._create_request(api_client, 'draft', chemical=CHEMICAL_NAME_LOWER)
        assert resp.status_code == status.HTTP_201_CREATED

    def test_reject_workflow(self, api_client, staff_user, hod_user):
        self._setup_inventory()
        self._login_as(api_client, staff_user)
        create_resp = self._create_request(api_client, 'draft')
        req_id = create_resp.data['id']
        api_client.post(f'/api/stock_request/{req_id}/submit/')

        self._login_as(api_client, hod_user)
        reject_resp = api_client.post(f'/api/stock_request/{req_id}/reject/', {
            'rejection_reason': 'Insufficient justification'
        }, format='json')
        assert reject_resp.status_code == status.HTTP_200_OK
        assert StockRequest.objects.get(id=req_id).status == 'rejected'
        assert StockRequest.objects.get(id=req_id).rejection_reason == 'Insufficient justification'

    def test_concurrent_issue_requests(self, api_client, store_keeper_user, staff_user, hod_user):
        self._setup_inventory()

        self._login_as(api_client, staff_user)
        sr1 = self._create_request(api_client, 'draft')
        req1_id = sr1.data['id']
        api_client.post(f'/api/stock_request/{req1_id}/submit/')

        self._login_as(api_client, hod_user)
        api_client.post(f'/api/stock_request/{req1_id}/accept/')

        self._login_as(api_client, store_keeper_user)
        api_client.post(f'/api/stock_request/{req1_id}/mark_as_issued/')

        self._login_as(api_client, staff_user)
        chem_item = StockRequest.objects.get(id=req1_id).chemical_items.first()
        api_client.post(f'/api/stock_request/{req1_id}/report_usage/', {
            'items': [{'id': chem_item.id, 'actual_used_quantity': '100.00'}],
        }, format='json')

        self._login_as(api_client, store_keeper_user)
        api_client.post(f'/api/stock_request/{req1_id}/mark_as_completed/')

        chem = AvailableChemical.objects.get(chemical_name=CHEMICAL_NAME)
        assert chem.quantity == Decimal('900.00')

    @pytest.mark.django_db(transaction=True)
    def test_issued_not_double_decremented(self, api_client, staff_user, hod_user, store_keeper_user):
        self._setup_inventory()

        self._login_as(api_client, staff_user)
        sr1 = self._create_request(api_client, 'draft')
        req1_id = sr1.data['id']
        api_client.post(f'/api/stock_request/{req1_id}/submit/')

        self._login_as(api_client, hod_user)
        api_client.post(f'/api/stock_request/{req1_id}/accept/')

        self._login_as(api_client, store_keeper_user)
        api_client.post(f'/api/stock_request/{req1_id}/mark_as_issued/')

        self._login_as(api_client, staff_user)
        chem_item = StockRequest.objects.get(id=req1_id).chemical_items.first()
        api_client.post(f'/api/stock_request/{req1_id}/report_usage/', {
            'items': [{'id': chem_item.id, 'actual_used_quantity': '100.00'}],
        }, format='json')

        self._login_as(api_client, store_keeper_user)
        api_client.post(f'/api/stock_request/{req1_id}/mark_as_completed/')

        chem = AvailableChemical.objects.get(chemical_name=CHEMICAL_NAME)
        assert chem.quantity == Decimal('900.00'), f"Expected 900.00, got {chem.quantity}"

        complete_again = api_client.post(f'/api/stock_request/{req1_id}/mark_as_completed/')
        assert complete_again.status_code == status.HTTP_400_BAD_REQUEST

        chem.refresh_from_db()
        assert chem.quantity == Decimal('900.00')
