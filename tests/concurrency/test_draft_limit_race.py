"""
Scenario 3 – Draft-limit / duplicate-submit race (same user).

The same staff user has two draft requests and submits both
concurrently. The submit action checks for existing active requests
BUT is NOT wrapped in @transaction.atomic and does NOT use
select_for_update().

Assert: only one ends up in pending/active state; the second is
        rejected with the "active request in progress" error, not
        silently allowed through.
"""
import uuid
from decimal import Decimal

import pytest
from django.db import transaction as db_transaction
from inventory.models import AvailableChemical
from stock_request.models import StockRequest

from .conftest import create_draft_request, run_concurrently

pytestmark = pytest.mark.django_db(transaction=True)

CHEM_NAME = f"DraftRaceChem_{uuid.uuid4().hex[:6]}"


def _login(client, user, password="test123"):
    resp = client.post("/api/users/login/", {
        "username": user.employee_id, "password": password,
    })
    assert resp.status_code == 200, f"Login failed: {resp.data}"
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")


class TestDraftLimitDuplicateSubmit:
    def test_concurrent_submit_two_drafts_same_user(
        self, staff_a, hod, store_keeper
    ):
        """
        Staff user creates two drafts concurrently, then submits
        both concurrently. Only one should reach 'pending'.
        """
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(staff_a).access_token}")

        chem_name = CHEM_NAME

        # Ensure chemical exists
        AvailableChemical.objects.get_or_create(
            chemical_name=chem_name,
            defaults={"quantity": Decimal("5000.00"), "unit": "ml", "reorder_level": Decimal("50.00")},
        )

        # Create two drafts
        r1 = create_draft_request(client, chem_name)
        r2 = create_draft_request(client, chem_name)
        assert r1.status_code == 201, f"Draft 1 failed: {r1.data}"
        assert r2.status_code == 201, f"Draft 2 failed: {r2.data}"
        req1_id = r1.data["id"]
        req2_id = r2.data["id"]

        # Submit both concurrently
        results = run_concurrently([
            lambda: client.post(f"/api/stock_request/{req1_id}/submit/"),
            lambda: client.post(f"/api/stock_request/{req2_id}/submit/"),
        ])

        status_codes = []
        for kind, val in results:
            if kind == "ok":
                status_codes.append(val.status_code)
            else:
                status_codes.append(f"exception:{type(val).__name__}")

        # Check final DB state
        sr1 = StockRequest.objects.get(id=req1_id)
        sr2 = StockRequest.objects.get(id=req2_id)
        pending_count = sum(
            1 for sr in [sr1, sr2] if sr.status in ("pending", "accepted", "issued", "reported")
        )

        # At most one should have become active (pending)
        assert pending_count <= 1, (
            f"FAIL: {pending_count} requests became active. "
            f"req1={sr1.status}, req2={sr2.status}. HTTP={status_codes}"
        )

        # At least one should have been rejected with 400
        ok_codes = [c for c in status_codes if c == 200]
        bad_codes = [c for c in status_codes if c == 400]
        assert len(bad_codes) >= 1, (
            f"FAIL: Expected at least one 400 rejection. HTTP={status_codes}. "
            f"req1={sr1.status}, req2={sr2.status}"
        )

    def test_submit_concurrent_with_active_request(
        self, staff_a, hod, store_keeper
    ):
        """
        Staff has one active (pending) request. Submits a second draft
        concurrently. The second submit should be rejected.
        """
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(staff_a).access_token}")

        chem_name = CHEM_NAME
        AvailableChemical.objects.get_or_create(
            chemical_name=chem_name,
            defaults={"quantity": Decimal("5000.00"), "unit": "ml", "reorder_level": Decimal("50.00")},
        )

        # Create two drafts (both status='draft' so neither triggers active-request guard)
        r1 = create_draft_request(client, chem_name)
        assert r1.status_code == 201, f"Draft 1 failed: {r1.data}"
        req1_id = r1.data["id"]

        r2 = create_draft_request(client, chem_name)
        assert r2.status_code == 201, f"Draft 2 failed: {r2.data}"
        req2_id = r2.data["id"]

        # Submit the first request — becomes pending (active)
        resp = client.post(f"/api/stock_request/{req1_id}/submit/")
        assert resp.status_code == 200, f"Submit 1 failed: {resp.data}"
        assert StockRequest.objects.get(id=req1_id).status == "pending"

        # Now submit the second draft — should be rejected because
        # an active request already exists
        resp2 = client.post(f"/api/stock_request/{req2_id}/submit/")
        assert resp2.status_code == 400, (
            f"FAIL: Expected 400 rejection for second submit, got {resp2.status_code}: {resp2.data}"
        )
        assert StockRequest.objects.get(id=req2_id).status == "draft", (
            f"FAIL: second request status should still be draft"
        )
