"""
Scenario 5 – Lock ordering / deadlock check.

Simulate concurrent transitions that touch overlapping sets of chemical
rows in different orders:
  - Request A issues chemicals [X, Y]
  - Request B issues [Y, X] concurrently

Assert: no deadlock errors (OperationalError: deadlock detected);
        both either complete or fail cleanly; no hang.
"""
import uuid
from decimal import Decimal

import pytest
from django.db import OperationalError
from inventory.models import AvailableChemical
from stock_request.models import StockRequest

from .conftest import run_concurrently

pytestmark = pytest.mark.django_db(transaction=True)

CHEM_X = f"DeadlockChemX_{uuid.uuid4().hex[:6]}"
CHEM_Y = f"DeadlockChemY_{uuid.uuid4().hex[:6]}"


def _client(user):
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return c


def _setup_chems():
    AvailableChemical.objects.get_or_create(
        chemical_name=CHEM_X,
        defaults={"quantity": Decimal("5000.00"), "unit": "ml", "reorder_level": Decimal("50.00")},
    )
    AvailableChemical.objects.get_or_create(
        chemical_name=CHEM_Y,
        defaults={"quantity": Decimal("5000.00"), "unit": "ml", "reorder_level": Decimal("50.00")},
    )


def _create_multi_chem_request(client, chem_names, qty="200.00"):
    """Create a draft request with multiple chemicals."""
    items = [{"chemical_name": c, "quantity": qty} for c in chem_names]
    resp = client.post("/api/stock_request/", {
        "class_name": "I B.Sc Chemistry",
        "day_order": "I",
        "hour": [1, 2],
        "purpose_type": "practical_lab",
        "experiment_name": f"DL_{uuid.uuid4().hex[:4]}",
        "chemical_items": items,
    }, format="json")
    return resp


class TestDeadlockCheck:
    def test_concurrent_issue_different_order(
        self, staff_a, staff_b, hod, store_keeper
    ):
        """
        Request A wants [ChemX, ChemY].
        Request B wants [ChemY, ChemX].
        Both are accepted. Fire mark_as_issued concurrently.
        Neither should deadlock. Both should succeed (stock is plentiful).
        """
        _setup_chems()
        ca = _client(staff_a)
        cb = _client(staff_b)
        hc = _client(hod)
        kc = _client(store_keeper)

        # Create requests
        r1 = _create_multi_chem_request(ca, [CHEM_X, CHEM_Y])
        assert r1.status_code == 201, f"Create A failed: {r1.data}"
        req1_id = r1.data["id"]

        r2 = _create_multi_chem_request(cb, [CHEM_Y, CHEM_X])
        assert r2.status_code == 201, f"Create B failed: {r2.data}"
        req2_id = r2.data["id"]

        # Submit and accept both
        ca.post(f"/api/stock_request/{req1_id}/submit/")
        cb.post(f"/api/stock_request/{req2_id}/submit/")
        hc.post(f"/api/stock_request/{req1_id}/accept/")
        hc.post(f"/api/stock_request/{req2_id}/accept/")

        # Fire both issues concurrently
        exceptions = []
        results = run_concurrently([
            lambda: kc.post(f"/api/stock_request/{req1_id}/mark_as_issued/"),
            lambda: kc.post(f"/api/stock_request/{req2_id}/mark_as_issued/"),
        ])

        # Check for deadlock errors
        for kind, val in results:
            if kind == "error":
                exceptions.append(str(val))

        deadlock_errors = [e for e in exceptions if "deadlock" in e.lower()]
        assert len(deadlock_errors) == 0, (
            f"FAIL: Deadlock detected! {deadlock_errors}"
        )

        # Both should have completed (either issued or failed cleanly)
        sr1 = StockRequest.objects.get(id=req1_id)
        sr2 = StockRequest.objects.get(id=req2_id)
        assert sr1.status in ("issued", "accepted"), f"FAIL: req1 status={sr1.status}"
        assert sr2.status in ("issued", "accepted"), f"FAIL: req2 status={sr2.status}"

        # Quantities should be non-negative
        for chem in [CHEM_X, CHEM_Y]:
            qty = AvailableChemical.objects.get(chemical_name=chem).quantity
            assert qty >= Decimal("0"), f"FAIL: {chem} qty={qty}"

    def test_concurrent_issue_three_chemicals(
        self, staff_a, staff_b, hod, store_keeper
    ):
        """
        Three chemicals (X, Y, Z). Request A wants [X, Y, Z].
        Request B wants [Z, Y, X]. Both accepted, fire concurrently.
        """
        CHEM_Z = f"DeadlockChemZ_{uuid.uuid4().hex[:6]}"
        AvailableChemical.objects.get_or_create(
            chemical_name=CHEM_Z,
            defaults={"quantity": Decimal("5000.00"), "unit": "ml", "reorder_level": Decimal("50.00")},
        )
        _setup_chems()

        ca = _client(staff_a)
        cb = _client(staff_b)
        hc = _client(hod)
        kc = _client(store_keeper)

        r1 = _create_multi_chem_request(ca, [CHEM_X, CHEM_Y, CHEM_Z])
        r2 = _create_multi_chem_request(cb, [CHEM_Z, CHEM_Y, CHEM_X])
        req1_id = r1.data["id"]
        req2_id = r2.data["id"]

        ca.post(f"/api/stock_request/{req1_id}/submit/")
        cb.post(f"/api/stock_request/{req2_id}/submit/")
        hc.post(f"/api/stock_request/{req1_id}/accept/")
        hc.post(f"/api/stock_request/{req2_id}/accept/")

        exceptions = []
        results = run_concurrently([
            lambda: kc.post(f"/api/stock_request/{req1_id}/mark_as_issued/"),
            lambda: kc.post(f"/api/stock_request/{req2_id}/mark_as_issued/"),
        ])

        for kind, val in results:
            if kind == "error":
                exceptions.append(str(val))

        deadlock_errors = [e for e in exceptions if "deadlock" in e.lower()]
        assert len(deadlock_errors) == 0, f"FAIL: Deadlock detected! {deadlock_errors}"

        for chem in [CHEM_X, CHEM_Y, CHEM_Z]:
            qty = AvailableChemical.objects.get(chemical_name=chem).quantity
            assert qty >= Decimal("0"), f"FAIL: {chem} qty={qty}"
