import pytest
from rest_framework import status
from inventory.models import AvailableApparatus
from damaged_entry.models import DamagedEntry

APPARATUS_NAME = "Beaker 250ml"
CLASS_NAME = "I B.Sc Chemistry"
STAFF_NAME = "Staff User"

pytestmark = pytest.mark.django_db


class TestM2DamagedEntry:

    def _setup_apparatus(self):
        AvailableApparatus.objects.create(
            apparatus_name=APPARATUS_NAME, available_quantity_pieces=50
        )

    def _create_damaged(self, client, data=None):
        if data is None:
            data = {
                'staff': STAFF_NAME,
                'class_name': CLASS_NAME,
                'date': '2026-06-26',
                'details': 'Broken during lab session',
                'damaged_items': [
                    {'apparatus_name': APPARATUS_NAME, 'quantity': 5, 'caused_by': 'Student A'},
                ],
            }
        return client.post('/api/damaged_entry/', data, format='json')

    def test_damaged_creates_record(self, auth_store_keeper):
        self._setup_apparatus()
        resp = self._create_damaged(auth_store_keeper)
        assert resp.status_code == status.HTTP_201_CREATED
        assert DamagedEntry.objects.count() == 1
        entry = DamagedEntry.objects.first()
        assert entry.staff == STAFF_NAME
        assert entry.class_name == CLASS_NAME
        assert entry.damaged_items.count() == 1

    def test_damaged_decrements_inventory(self, auth_store_keeper):
        self._setup_apparatus()
        resp = self._create_damaged(auth_store_keeper)
        assert resp.status_code == status.HTTP_201_CREATED
        app = AvailableApparatus.objects.get(apparatus_name=APPARATUS_NAME)
        assert app.available_quantity_pieces == 45

    def test_multiple_items_decrement(self, auth_store_keeper):
        self._setup_apparatus()
        resp = auth_store_keeper.post('/api/damaged_entry/', {
            'staff': STAFF_NAME,
            'class_name': CLASS_NAME,
            'date': '2026-06-26',
            'damaged_items': [
                {'apparatus_name': APPARATUS_NAME, 'quantity': 10, 'caused_by': 'Student A'},
                {'apparatus_name': APPARATUS_NAME, 'quantity': 5, 'caused_by': 'Student B'},
            ],
        }, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        app = AvailableApparatus.objects.get(apparatus_name=APPARATUS_NAME)
        assert app.available_quantity_pieces == 35

    def test_damaged_quantity_exceeds_available(self, auth_store_keeper):
        self._setup_apparatus()
        resp = auth_store_keeper.post('/api/damaged_entry/', {
            'staff': STAFF_NAME,
            'class_name': CLASS_NAME,
            'date': '2026-06-26',
            'damaged_items': [
                {'apparatus_name': APPARATUS_NAME, 'quantity': 100, 'caused_by': 'Student A'},
            ],
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_damaged_zero_quantity_error(self, auth_store_keeper):
        self._setup_apparatus()
        resp = auth_store_keeper.post('/api/damaged_entry/', {
            'staff': STAFF_NAME,
            'class_name': CLASS_NAME,
            'date': '2026-06-26',
            'damaged_items': [
                {'apparatus_name': APPARATUS_NAME, 'quantity': 0, 'caused_by': 'Student A'},
            ],
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_apparatus_not_found_error(self, auth_store_keeper):
        resp = auth_store_keeper.post('/api/damaged_entry/', {
            'staff': STAFF_NAME,
            'class_name': CLASS_NAME,
            'date': '2026-06-26',
            'damaged_items': [
                {'apparatus_name': 'Nonexistent Apparatus', 'quantity': 5, 'caused_by': 'Student A'},
            ],
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_damaged_log_fields_persisted(self, auth_store_keeper):
        self._setup_apparatus()
        resp = self._create_damaged(auth_store_keeper)
        assert resp.status_code == status.HTTP_201_CREATED
        entry = DamagedEntry.objects.first()
        item = entry.damaged_items.first()
        assert item.apparatus_name == APPARATUS_NAME
        assert item.quantity == 5
        assert item.caused_by == 'Student A'
        assert entry.date.isoformat() == '2026-06-26'

    def test_store_keeper_permission(self, auth_hod, auth_staff, auth_store_keeper):
        self._setup_apparatus()
        resp_hod = auth_hod.post('/api/damaged_entry/', {}, format='json')
        assert resp_hod.status_code == status.HTTP_403_FORBIDDEN
        resp_staff = auth_staff.get('/api/damaged_entry/')
        assert resp_staff.status_code == status.HTTP_403_FORBIDDEN
        resp_sk = auth_store_keeper.get('/api/damaged_entry/')
        assert resp_sk.status_code == status.HTTP_200_OK

    def test_hod_can_view(self, auth_hod):
        self._setup_apparatus()
        resp = auth_hod.get('/api/damaged_entry/')
        assert resp.status_code == status.HTTP_200_OK
