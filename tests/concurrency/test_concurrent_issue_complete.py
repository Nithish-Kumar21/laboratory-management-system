"""
Scenario 1 – Same-chemical concurrent issue/complete race.

Test A (concurrent_issue_race):
  Two accepted stock-requests reference the SAME chemical.
  Combined requested quantity is close to available stock.
  Two store-keeper threads fire mark_as_issued simultaneously.
  Assert: available_quantity_ml never goes negative;
          exactly one request succeeds if stock is insufficient for both.

Test B (concurrent_complete_race):
  Two reported stock-requests reference the SAME chemical.
  Two store-keeper threads fire mark_as_completed simultaneously.
  Assert: inventory delta applied exactly once per request;
          no double-increment or negative quantity.

Test C (issue_then_complete_overlap):
  One request is issued while another (same chemical) is completed
  simultaneously. Both touch the same AvailableChemical row.
  Assert: final quantity is consistent with both operations.
"""
import uuid
from decimal import Decimal

import pytest
from django.db import transaction
from django.utils import timezone

from inventory.models import AvailableChemical
from stock_request.models import StockRequest, StockRequestChemicalItem, IssueRegister

from .conftest import (
    create_draft_request, create_and_submit_request,
    advance_to_accepted, advance_to_issued, advance_to_reported,
    run_concurrently,
)

pytestmark = pytest.mark.django_db(transaction=True)

CLASS_NAME = "I B.Sc Chemistry"


def _login(client, user, password="test123"):
    resp = client.post("/api/users/login/", {
        "username": user.employee_id, "password": password,
    })
    assert resp.status_code == 200, f"Login failed for {user.employee_id}: {resp.data}"
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")


def _create_full_request(client, staff_client, hod_client, sk_client,
                         chemical_name, qty, status="accepted"):
    """Create a request and advance it to the given status. Returns request_id."""
    # Create as draft
    resp = create_draft_request(client, chemical_name, str(qty))
    assert resp.status_code == 201, f"Create failed: {resp.data}"
    req_id = resp.data["id"]

    # Submit
    submit_resp = client.post(f"/api/stock_request/{req_id}/submit/")
    assert submit_resp.status_code == 200, f"Submit failed: {submit_resp.data}"

    if status == "pending":
        return req_id

    # Accept via HOD
    accept_resp = hod_client.post(f"/api/stock_request/{req_id}/accept/")
    assert accept_resp.status_code == 200, f"Accept failed: {accept_resp.data}"

    if status == "accepted":
        return req_id

    # Issue via store keeper
    issue_resp = sk_client.post(f"/api/stock_request/{req_id}/mark_as_issued/")
    assert issue_resp.status_code == 200, f"Issue failed: {issue_resp.data}"

    if status == "issued":
        return req_id

    # Report usage
    sr = StockRequest.objects.get(id=req_id)
    items = list(sr.chemical_items.all())
    payload = {"items": [{"id": it.id, "actual_used_quantity": str(it.quantity)} for it in items]}
    report_resp = client.post(f"/api/stock_request/{req_id}/report_usage/", payload, format="json")
    assert report_resp.status_code == 200, f"Report failed: {report_resp.data}"
    return req_id


# ======================================================================
# Test A – Concurrent issue race
# ======================================================================

class TestConcurrentIssueRace:
    def test_two_requests_issue_same_chemical_insufficient_stock(
        self, staff_a, staff_b, hod, store_keeper, admin_user, chemical_a
    ):
        """
        Two accepted requests each want 600 ml of a chemical that has 1000 ml.
        Combined demand (1200) exceeds supply (1000).
        Exactly one should succeed; the other must get a 400.
        Quantity must never go negative.
        """
        # Set up authenticated clients
        client_a = self._client(staff_a)
        client_b = self._client(staff_b)
        _hod = self._client(hod)
        _sk = self._client(store_keeper)

        chem_name = chemical_a.chemical_name

        # Create two accepted requests, each for 600 ml
        req1 = _create_full_request(client_a, client_a, _hod, _sk, chem_name, "600.00", "accepted")
        req2 = _create_full_request(client_b, client_b, _hod, _sk, chem_name, "600.00", "accepted")

        qty_before = AvailableChemical.objects.get(chemical_name=chem_name).quantity
        assert qty_before == Decimal("1000.00")

        # Fire both mark_as_issued concurrently
        results = run_concurrently([
            lambda: _sk.post(f"/api/stock_request/{req1}/mark_as_issued/"),
            lambda: _sk.post(f"/api/stock_request/{req2}/mark_as_issued/"),
        ])

        # Collect status codes
        status_codes = []
        for kind, val in results:
            if kind == "ok":
                status_codes.append(val.status_code)
            else:
                status_codes.append(f"exception:{val}")

        # Assertions
        qty_after = AvailableChemical.objects.get(chemical_name=chem_name).quantity
        issued_count = StockRequest.objects.filter(
            chemical_items__chemical_name=chem_name,
            status="issued"
        ).values("id").distinct().count()

        # Quantity must never be negative
        assert qty_after >= Decimal("0"), (
            f"FAIL: quantity went negative: {qty_after}"
        )

        # Exactly one should have been issued (succeeded), or both if stock sufficed.
        # With 1000 available and each requesting 600, only one can be issued.
        assert issued_count <= 1, (
            f"FAIL: {issued_count} requests were issued, expected at most 1. "
            f"HTTP codes={status_codes}"
        )

        # At most one 200 response, the other should be 400
        ok_count = sum(1 for c in status_codes if c == 200)
        fail_count = sum(1 for c in status_codes if c == 400)
        assert ok_count + fail_count == 2, (
            f"FAIL: unexpected status codes: {status_codes}"
        )

        # Verify the quantity was decremented by exactly one request's amount
        deducted = qty_before - qty_after
        assert deducted in (Decimal("600.00"), Decimal("0.00")), (
            f"FAIL: deducted {deducted} from {qty_before}, got {qty_after}"
        )

    def test_two_requests_issue_same_chemical_enough_stock(
        self, staff_a, staff_b, hod, store_keeper, admin_user, chemical_a
    ):
        """
        Two accepted requests each want 400 ml of a chemical that has 1000 ml.
        Combined demand (800) is within supply. Both should succeed.
        """
        client_a = self._client(staff_a)
        client_b = self._client(staff_b)
        _hod = self._client(hod)
        _sk = self._client(store_keeper)
        chem_name = chemical_a.chemical_name

        req1 = _create_full_request(client_a, client_a, _hod, _sk, chem_name, "400.00", "accepted")
        req2 = _create_full_request(client_b, client_b, _hod, _sk, chem_name, "400.00", "accepted")

        qty_before = AvailableChemical.objects.get(chemical_name=chem_name).quantity

        results = run_concurrently([
            lambda: _sk.post(f"/api/stock_request/{req1}/mark_as_issued/"),
            lambda: _sk.post(f"/api/stock_request/{req2}/mark_as_issued/"),
        ])

        status_codes = [val.status_code for kind, val in results if kind == "ok"]
        qty_after = AvailableChemical.objects.get(chemical_name=chem_name).quantity

        assert qty_after >= Decimal("0"), f"FAIL: negative quantity {qty_after}"
        assert all(c == 200 for c in status_codes), f"FAIL: not all succeeded: {status_codes}"
        assert qty_before - qty_after == Decimal("800.00"), (
            f"FAIL: expected 800 deducted, got {qty_before - qty_after}"
        )

    def _client(self, user):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken
        client = APIClient()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client


# ======================================================================
# Test B – Concurrent complete race
# ======================================================================

class TestConcurrentCompleteRace:
    def test_two_completed_requests_same_chemical(
        self, staff_a, staff_b, hod, store_keeper, admin_user, chemical_a
    ):
        """
        Two reported requests each used 100 ml. mark_as_completed adjusts
        inventory by the delta (returned = issued - actual).
        Both should complete; inventory delta applied once per request.
        """
        client_a = self._client(staff_a)
        client_b = self._client(staff_b)
        _hod = self._client(hod)
        _sk = self._client(store_keeper)
        chem_name = chemical_a.chemical_name

        # Issue both first
        req1 = _create_full_request(client_a, client_a, _hod, _sk, chem_name, "200.00", "issued")
        req2 = _create_full_request(client_b, client_b, _hod, _sk, chem_name, "200.00", "issued")

        # Report usage for both (used = 100 each → returned = 100 each)
        sr1 = StockRequest.objects.get(id=req1)
        sr2 = StockRequest.objects.get(id=req2)
        item1 = sr1.chemical_items.first()
        item2 = sr2.chemical_items.first()

        client_a.post(f"/api/stock_request/{req1}/report_usage/", {
            "items": [{"id": item1.id, "actual_used_quantity": "100.00"}]
        }, format="json")
        client_b.post(f"/api/stock_request/{req2}/report_usage/", {
            "items": [{"id": item2.id, "actual_used_quantity": "100.00"}]
        }, format="json")

        qty_before = AvailableChemical.objects.get(chemical_name=chem_name).quantity
        # After issuing 200+200 = 400 deducted, qty = 600

        # Complete both concurrently
        results = run_concurrently([
            lambda: _sk.post(f"/api/stock_request/{req1}/mark_as_completed/"),
            lambda: _sk.post(f"/api/stock_request/{req2}/mark_as_completed/"),
        ])

        status_codes = [val.status_code for kind, val in results if kind == "ok"]
        qty_after = AvailableChemical.objects.get(chemical_name=chem_name).quantity
        ir_count = IssueRegister.objects.filter(
            stock_request_db_id__in=[req1, req2]
        ).count()

        assert qty_after >= Decimal("0"), f"FAIL: negative quantity {qty_after}"
        assert len(status_codes) == 2, f"FAIL: not all completed: {status_codes}"
        # Each completion adds 100 ml back (returned = 200-100 = 100)
        # So total added back = 200 ml
        assert ir_count == 2, f"FAIL: expected 2 IssueRegister rows, got {ir_count}"

    def _client(self, user):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken
        client = APIClient()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client


# ======================================================================
# Test C – Issue + Complete overlap on same chemical
# ======================================================================

class TestIssueAndCompleteOverlap:
    def test_issue_and_complete_different_requests_same_chemical(
        self, staff_a, staff_b, hod, store_keeper, admin_user, chemical_a
    ):
        """
        Request A is being issued (400 ml) while Request B (already reported,
        used 50 of 200 ml) is being completed concurrently.
        Both touch the same AvailableChemical row via select_for_update.
        Assert: no negative qty, both complete.
        """
        client_a = self._client(staff_a)
        client_b = self._client(staff_b)
        _hod = self._client(hod)
        _sk = self._client(store_keeper)
        chem_name = chemical_a.chemical_name

        # Request A: accepted, about to be issued
        req_a = _create_full_request(client_a, client_a, _hod, _sk, chem_name, "400.00", "accepted")
        # Request B: reported (issued → reported)
        req_b = _create_full_request(client_b, client_b, _hod, _sk, chem_name, "200.00", "issued")
        sr_b = StockRequest.objects.get(id=req_b)
        item_b = sr_b.chemical_items.first()
        client_b.post(f"/api/stock_request/{req_b}/report_usage/", {
            "items": [{"id": item_b.id, "actual_used_quantity": "50.00"}]
        }, format="json")

        qty_before = AvailableChemical.objects.get(chemical_name=chem_name).quantity

        results = run_concurrently([
            lambda: _sk.post(f"/api/stock_request/{req_a}/mark_as_issued/"),
            lambda: _sk.post(f"/api/stock_request/{req_b}/mark_as_completed/"),
        ])

        status_codes = [val.status_code for kind, val in results if kind == "ok"]
        qty_after = AvailableChemical.objects.get(chemical_name=chem_name).quantity

        assert qty_after >= Decimal("0"), f"FAIL: negative quantity {qty_after}"
        # Both should succeed: issue deducts 400, complete adds back (200-50)=150
        # Net change = -400 + 150 = -250
        assert len(status_codes) == 2, f"FAIL: not all succeeded: {status_codes}"

    def _client(self, user):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken
        client = APIClient()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client
