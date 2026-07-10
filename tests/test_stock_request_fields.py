import pytest
from decimal import Decimal
from rest_framework import status
from django.utils import timezone
from django.db import connection
from stock_request.models import StockRequest
from inventory.models import AvailableChemical

CHEMICAL_NAME = "Test Chemical for Fields"
CLASS_NAME = "I B.Sc Chemistry"
pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _add_columns(db, django_db_blocker):
    with connection.cursor() as cursor:
        for col, dtype in [
            ('day_order', 'varchar(5)'),
            ('hour', 'integer[]'),
            ('purpose_type', 'varchar(20)'),
            ('experiment_name', 'text'),
            ('student_name', 'varchar(100)'),
        ]:
            cursor.execute(f"""
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='stock_request' AND column_name='{col}'
                    ) THEN
                        ALTER TABLE stock_request ADD COLUMN {col} {dtype} NULL;
                    END IF;
                END $$;
            """)


class TestStockRequestNewFields:

    def _setup_chemical(self):
        AvailableChemical.objects.get_or_create(
            chemical_name=CHEMICAL_NAME,
            defaults={'quantity': Decimal('500.00'), 'reorder_level': Decimal('50.00'), 'unit': 'ml'}
        )

    def _create_request(self, client, **overrides):
        data = {
            'class_name': CLASS_NAME,
            'date': timezone.now().date().isoformat(),
            'day_order': 'I',
            'hour': [1, 2],
            'purpose_type': 'practical_lab',
            'experiment_name': 'Titration',
            'chemical_items': [
                {'chemical_name': CHEMICAL_NAME, 'quantity': '10.00'},
            ],
        }
        data.update(overrides)
        return client.post('/api/stock_request/', data, format='json')

    def test_day_order_save_and_retrieve(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(auth_staff, day_order='III')
        assert resp.status_code == status.HTTP_201_CREATED
        req = StockRequest.objects.get(id=resp.data['id'])
        assert req.day_order == 'III'

    def test_hour_array_save_and_retrieve(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(auth_staff, hour=[1, 3, 5])
        assert resp.status_code == status.HTTP_201_CREATED
        req = StockRequest.objects.get(id=resp.data['id'])
        assert req.hour == [1, 3, 5]

    def test_hour_single_value(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(auth_staff, hour=[2])
        assert resp.status_code == status.HTTP_201_CREATED
        req = StockRequest.objects.get(id=resp.data['id'])
        assert req.hour == [2]

    def test_hour_all_values(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(auth_staff, hour=[1, 2, 3, 4, 5])
        assert resp.status_code == status.HTTP_201_CREATED
        req = StockRequest.objects.get(id=resp.data['id'])
        assert req.hour == [1, 2, 3, 4, 5]

    def test_hour_empty_rejected(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(auth_staff, hour=[])
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_practical_lab_requires_experiment_name(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(auth_staff, purpose_type='practical_lab', experiment_name='')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_practical_lab_rejects_student_name(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(
            auth_staff, purpose_type='practical_lab',
            experiment_name='Titration', student_name='John'
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_research_project_save_and_retrieve(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(
            auth_staff, purpose_type='research_project',
            experiment_name='Project X', student_name='Alice'
        )
        assert resp.status_code == status.HTTP_201_CREATED
        req = StockRequest.objects.get(id=resp.data['id'])
        assert req.purpose_type == 'research_project'
        assert req.experiment_name == 'Project X'
        assert req.student_name == 'Alice'

    def test_research_project_requires_student_name(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(
            auth_staff, purpose_type='research_project',
            experiment_name='Project X', student_name=''
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_research_project_requires_experiment_name(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(
            auth_staff, purpose_type='research_project',
            experiment_name='', student_name='Bob'
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_class_date_not_affected_by_layout(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(auth_staff, class_name=CLASS_NAME)
        assert resp.status_code == status.HTTP_201_CREATED
        req = StockRequest.objects.get(id=resp.data['id'])
        assert req.class_name == CLASS_NAME
        assert req.date == timezone.now().date()

    def test_all_fields_in_detail_endpoint(self, auth_staff):
        self._setup_chemical()
        resp = self._create_request(
            auth_staff, purpose_type='research_project',
            experiment_name='Advanced Chem', student_name='Bob',
            day_order='V', hour=[2, 4]
        )
        assert resp.status_code == status.HTTP_201_CREATED
        detail = auth_staff.get(f'/api/stock_request/{resp.data["id"]}/')
        assert detail.status_code == status.HTTP_200_OK
        assert detail.data['day_order'] == 'V'
        assert detail.data['hour'] == [2, 4]
        assert detail.data['purpose_type'] == 'research_project'
        assert detail.data['experiment_name'] == 'Advanced Chem'
        assert detail.data['student_name'] == 'Bob'
