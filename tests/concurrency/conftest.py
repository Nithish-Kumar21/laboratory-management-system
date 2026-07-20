"""
Shared fixtures for concurrency verification tests.

All tests in this package MUST use transaction=True so each thread
can commit independently and we can observe real DB state.
"""
import uuid
import pytest
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from inventory.models import AvailableChemical, AvailableApparatus
from stock_request.models import (
    StockRequest, StockRequestChemicalItem,
)

User = get_user_model()

RUN_ID = uuid.uuid4().hex[:8]


def _make_token(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


def _make_client(token):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


# ---------------------------------------------------------------------------
# User fixtures – unique per test via RUN_ID + unique suffix
# ---------------------------------------------------------------------------

HOD_PASSWORD = "test123"
SK_PASSWORD = "Test@Pass123!"


@pytest.fixture
def staff_a(db):
    suffix = uuid.uuid4().hex[:6]
    return User.objects.create_user(
        employee_id=f"conc_sa_{suffix}", email=f"conc_sa_{suffix}@test.local",
        password="test123", role="staff", full_name=f"Conc Staff A {suffix}",
        phone=f"+91{1000000000 + hash(suffix) % 9000000000 % 10000000000:010d}"[-10:],
        designation="Staff", department="B.Sc Chemistry",
    )


@pytest.fixture
def staff_b(db):
    suffix = uuid.uuid4().hex[:6]
    return User.objects.create_user(
        employee_id=f"conc_sb_{suffix}", email=f"conc_sb_{suffix}@test.local",
        password="test123", role="staff", full_name=f"Conc Staff B {suffix}",
        phone=f"+91{2000000000 + hash(suffix) % 9000000000 % 10000000000:010d}"[-10:],
        designation="Staff", department="B.Sc Chemistry",
    )


@pytest.fixture
def hod(db):
    """Use the existing HOD (DB enforces single-HOD constraint)."""
    user, _ = User.objects.get_or_create(
        role="hod",
        defaults={
            "employee_id": "test_hod",
            "email": "hod@test.com",
            "full_name": "Dr. Test HOD",
            "phone": "+919999999991",
            "designation": "HOD",
            "department": "B.Sc Chemistry",
        },
    )
    if not user.check_password(HOD_PASSWORD):
        user.set_password(HOD_PASSWORD)
        user.save()
    return user


@pytest.fixture
def store_keeper(db):
    """Use the existing store_keeper (DB enforces single-SK constraint)."""
    user, _ = User.objects.get_or_create(
        role="store_keeper",
        defaults={
            "employee_id": "test_store_keeper",
            "email": "sk@test.com",
            "full_name": "Test Store Keeper",
            "phone": "+919999999992",
            "designation": "Store Keeper",
            "department": "B.Sc Chemistry",
        },
    )
    if not user.check_password(SK_PASSWORD):
        user.set_password(SK_PASSWORD)
        user.save()
    return user


@pytest.fixture
def admin_user(db):
    suffix = uuid.uuid4().hex[:6]
    return User.objects.create_user(
        employee_id=f"conc_adm_{suffix}", email=f"conc_adm_{suffix}@test.local",
        password="test123", role="admin", full_name=f"Conc Admin {suffix}",
        phone=f"+91{5000000000 + hash(suffix) % 9000000000 % 10000000000:010d}"[-10:],
        designation="Admin", department="B.Sc Chemistry",
        is_staff=True, is_superuser=True,
    )


# ---------------------------------------------------------------------------
# Token / client fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def staff_a_client(staff_a):
    return _make_client(_make_token(staff_a))


@pytest.fixture
def staff_b_client(staff_b):
    return _make_client(_make_token(staff_b))


@pytest.fixture
def hod_client(hod):
    client = APIClient()
    resp = client.post("/api/users/login/", {
        "username": hod.employee_id, "password": HOD_PASSWORD,
    })
    assert resp.status_code == 200, f"HOD login failed: {resp.data}"
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


@pytest.fixture
def sk_client(store_keeper):
    client = APIClient()
    resp = client.post("/api/users/login/", {
        "username": store_keeper.employee_id, "password": SK_PASSWORD,
    })
    assert resp.status_code == 200, f"SK login failed: {resp.data}"
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


@pytest.fixture
def admin_client(admin_user):
    return _make_client(_make_token(admin_user))


# ---------------------------------------------------------------------------
# Inventory helpers
# ---------------------------------------------------------------------------

CHEM_PREFIX = f"ConcChem_{RUN_ID}"

@pytest.fixture
def chemical_a(db):
    name = f"{CHEM_PREFIX}_A"
    chem, _ = AvailableChemical.objects.get_or_create(
        chemical_name=name,
        defaults={"quantity": Decimal("1000.00"), "unit": "ml", "reorder_level": Decimal("50.00")},
    )
    chem.quantity = Decimal("1000.00")
    chem.save(update_fields=["quantity"])
    return chem


@pytest.fixture
def chemical_b(db):
    name = f"{CHEM_PREFIX}_B"
    chem, _ = AvailableChemical.objects.get_or_create(
        chemical_name=name,
        defaults={"quantity": Decimal("1000.00"), "unit": "ml", "reorder_level": Decimal("50.00")},
    )
    chem.quantity = Decimal("1000.00")
    chem.save(update_fields=["quantity"])
    return chem


# ---------------------------------------------------------------------------
# Stock request creation helper
# ---------------------------------------------------------------------------

def create_draft_request(client, chemical_name, quantity="200.00", user=None):
    """Create a stock request in draft status and return response."""
    resp = client.post("/api/stock_request/", {
        "class_name": "I B.Sc Chemistry",
        "day_order": "I",
        "hour": [1, 2],
        "purpose_type": "practical_lab",
        "experiment_name": f"ConcTest_{uuid.uuid4().hex[:6]}",
        "status": "draft",
        "chemical_items": [
            {"chemical_name": chemical_name, "quantity": quantity},
        ],
    }, format="json")
    return resp


def create_and_submit_request(client, chemical_name, quantity="200.00"):
    """Create a stock request in draft and immediately submit it."""
    resp = create_draft_request(client, chemical_name, quantity)
    assert resp.status_code == 201, f"Create failed: {resp.data}"
    req_id = resp.data["id"]
    submit_resp = client.post(f"/api/stock_request/{req_id}/submit/")
    assert submit_resp.status_code == 200, f"Submit failed: {submit_resp.data}"
    return req_id


def advance_to_accepted(client, sk_client, hod_client, req_id):
    """Accept a pending request via HOD."""
    resp = hod_client.post(f"/api/stock_request/{req_id}/accept/")
    assert resp.status_code == 200, f"Accept failed: {resp.data}"


def advance_to_issued(client, sk_client, req_id):
    """Issue a request via store keeper."""
    resp = sk_client.post(f"/api/stock_request/{req_id}/mark_as_issued/")
    return resp


def advance_to_reported(client, staff_client, req_id):
    """Report usage for an issued request."""
    sr = StockRequest.objects.get(id=req_id)
    items = list(sr.chemical_items.all())
    payload = {
        "items": [
            {"id": item.id, "actual_used_quantity": str(item.quantity)}
            for item in items
        ]
    }
    resp = staff_client.post(f"/api/stock_request/{req_id}/report_usage/", payload, format="json")
    return resp


# ---------------------------------------------------------------------------
# Concurrent executor helper
# ---------------------------------------------------------------------------

def run_concurrently(funcs, max_workers=None):
    """
    Run a list of callables concurrently via ThreadPoolExecutor.
    Returns list of (index, result) tuples. Exceptions are captured.
    """
    if max_workers is None:
        max_workers = len(funcs)
    results = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_idx = {executor.submit(fn): i for i, fn in enumerate(funcs)}
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                results[idx] = ("ok", future.result())
            except Exception as exc:
                results[idx] = ("error", exc)
    return [results[i] for i in sorted(results.keys())]
