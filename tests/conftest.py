import os
import sys
import pytest
from decimal import Decimal


os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings_test'
import django
django.setup()

import django.db.backends.base.operations as _base_ops
_original_execute_sql_flush = _base_ops.BaseDatabaseOperations.execute_sql_flush

def _cascade_execute_sql_flush(self, sql_list):
    patched = []
    for sql in sql_list:
        s = sql.strip().rstrip(";")
        if s.upper().startswith("TRUNCATE") and "CASCADE" not in s.upper():
            s += " CASCADE"
        patched.append(s + ";")
    return _original_execute_sql_flush(self, patched)

_base_ops.BaseDatabaseOperations.execute_sql_flush = _cascade_execute_sql_flush


from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from inventory.models import AvailableChemical, AvailableApparatus

User = get_user_model()

CHEM_NAME = "Hydrochloric Acid"
CHEM_NAME_LOWER = "hydrochloric acid"
APPARATUS_NAME = "Beaker 250ml"


@pytest.fixture(autouse=True, scope="session")
def assert_postgres():
    from django.conf import settings
    engine = settings.DATABASES["default"]["ENGINE"]
    assert "postgresql" in engine, f"STOP — tests are running on {engine}, not PostgreSQL. Fix settings_test.py."


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def hod_user(db):
    user = User.objects.create_user(
        employee_id='hod_test', email='hod@test.com', password='test123',
        role='hod', full_name='HOD User', phone='+919999999991',
        designation='HOD', department='B.Sc Chemistry'
    )
    return user


@pytest.fixture
def store_keeper_user(db):
    user = User.objects.create_user(
        employee_id='sk_test', email='sk@test.com', password='test123',
        role='store_keeper', full_name='Store Keeper', phone='+919999999992',
        designation='Store Keeper', department='B.Sc Chemistry'
    )
    return user


@pytest.fixture
def staff_user(db):
    user = User.objects.create_user(
        employee_id='staff_test', email='staff@test.com', password='test123',
        role='staff', full_name='Staff User', phone='+919999999993',
        designation='Staff', department='B.Sc Chemistry'
    )
    return user


@pytest.fixture
def admin_user(db):
    user = User.objects.create_user(
        employee_id='admin_test', email='admin@test.com', password='test123',
        role='admin', full_name='Admin User', phone='+919999999994',
        designation='Admin', department='B.Sc Chemistry',
        is_staff=True, is_superuser=True
    )
    return user


def get_token(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


def auth_headers(token):
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


@pytest.fixture
def hod_token(hod_user):
    return get_token(hod_user)


@pytest.fixture
def store_keeper_token(store_keeper_user):
    return get_token(store_keeper_user)


@pytest.fixture
def staff_token(staff_user):
    return get_token(staff_user)


@pytest.fixture
def admin_token(admin_user):
    return get_token(admin_user)


@pytest.fixture
def auth_hod(hod_token):
    client = APIClient()
    client.credentials(**auth_headers(hod_token))
    return client


@pytest.fixture
def auth_store_keeper(store_keeper_token):
    client = APIClient()
    client.credentials(**auth_headers(store_keeper_token))
    return client


@pytest.fixture
def auth_staff(staff_token):
    client = APIClient()
    client.credentials(**auth_headers(staff_token))
    return client


@pytest.fixture
def auth_admin(admin_token):
    client = APIClient()
    client.credentials(**auth_headers(admin_token))
    return client


@pytest.fixture
def existing_chemical(db):
    chem, _ = AvailableChemical.objects.get_or_create(
        chemical_name=CHEM_NAME,
        defaults={'quantity': Decimal('500.00'), 'reorder_level': Decimal('50.00'), 'unit': 'ml'}
    )
    return chem


@pytest.fixture
def existing_apparatus(db):
    app, _ = AvailableApparatus.objects.get_or_create(
        apparatus_name=APPARATUS_NAME,
        defaults={'available_quantity_pieces': 100, 'reorder_level': 10}
    )
    return app


@pytest.fixture(autouse=True)
def _ensure_venue_column(db):
    """Ensure the venue column exists on the stock_request table (managed=False model)."""
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='stock_request' AND column_name='venue'
                ) THEN
                    ALTER TABLE stock_request ADD COLUMN venue varchar(100) NULL DEFAULT 'B.Sc Chemistry Laboratory';
                END IF;
            END $$;
        """)


@pytest.fixture
def today():
    return timezone.now().date()
