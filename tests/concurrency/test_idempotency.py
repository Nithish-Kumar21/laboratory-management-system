"""
Scenario 4 – Idempotency under concurrent duplicate calls.

Fire 2+ simultaneous identical requests to each state-transition endpoint
(submit, accept, reject, mark_as_issued, report_usage, mark_as_completed)
against the same object.

Assert: no double state change, no double inventory adjustment,
        no duplicate IssueRegister/IssueChemicals/audit log entries.
"""
import uuid
from decimal import Decimal

import pytest
from inventory.models import AvailableChemical
from stock_request.models import StockRequest, IssueRegister, IssueChemicals
from audit.models import AuditLog

from .conftest import run_concurrently

pytestmark = pytest.mark.django_db(transaction=True)

CHEM_NAME = f"IdemChem_{uuid.uuid4().hex[:6]}"


def _client(user):
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return c


def _setup_chem():
    return AvailableChemical.objects.get_or_create(
        chemical_name=CHEM_NAME,
        defaults={"quantity": Decimal("10000.00"), "unit": "ml", "reorder_level": Decimal("50.00")},
    )[0]


def _create_draft(client, chem_name=None):
    if chem_name is None:
        chem_name = CHEM_NAME
    resp = client.post("/api/stock_request/", {
        "class_name": "I B.Sc Chemistry",
        "day_order": "I",
        "hour": [1, 2],
        "purpose_type": "practical_lab",
        "experiment_name": f"Idem_{uuid.uuid4().hex[:4]}",
        "chemical_items": [{"chemical_name": chem_name, "quantity": "200.00"}],
    }, format="json")
    assert resp.status_code == 201, f"Create failed: {resp.data}"
    return resp.data["id"]


def _count_audit(user, action, req_id):
    return AuditLog.objects.filter(
        user=user, action=action, entity_id=req_id
    ).count()


class TestSubmitIdempotency:
    def test_concurrent_duplicate_submit(self, staff_a):
        """
        Two concurrent submits on the SAME draft request.
        Only one should change status to pending; the other is idempotent (200 "Already submitted").
        """
        _setup_chem()
        sc = _client(staff_a)
        req_id = _create_draft(sc)

        results = run_concurrently([
            lambda: sc.post(f"/api/stock_request/{req_id}/submit/"),
            lambda: sc.post(f"/api/stock_request/{req_id}/submit/"),
        ])

        status_codes = [val.status_code for kind, val in results if kind == "ok"]
        sr = StockRequest.objects.get(id=req_id)

        assert sr.status == "pending", f"FAIL: status={sr.status}"
        assert all(c in (200, 200) for c in status_codes), f"FAIL: codes={status_codes}"
        assert _count_audit(staff_a, "REQUEST_SUBMITTED", req_id) <= 2


class TestIssueIdempotency:
    def test_concurrent_duplicate_issue(self, staff_a, hod, store_keeper):
        """
        Two concurrent mark_as_issued calls on the SAME accepted request.
        Should not double-decrement inventory.
        """
        _setup_chem()
        sc = _client(staff_a)
        hc = _client(hod)
        kc = _client(store_keeper)
        req_id = _create_draft(sc)
        sc.post(f"/api/stock_request/{req_id}/submit/")
        hc.post(f"/api/stock_request/{req_id}/accept/")

        qty_before = AvailableChemical.objects.get(chemical_name=CHEM_NAME).quantity

        results = run_concurrently([
            lambda: kc.post(f"/api/stock_request/{req_id}/mark_as_issued/"),
            lambda: kc.post(f"/api/stock_request/{req_id}/mark_as_issued/"),
        ])

        sr = StockRequest.objects.get(id=req_id)
        qty_after = AvailableChemical.objects.get(chemical_name=CHEM_NAME).quantity
        deducted = qty_before - qty_after

        assert sr.status == "issued", f"FAIL: status={sr.status}"
        # Inventory should be decremented exactly once (200 ml)
        assert deducted == Decimal("200.00"), (
            f"FAIL: deducted {deducted} (expected 200.00). qty {qty_before}->{qty_after}"
        )


class TestReportUsageIdempotency:
    def test_concurrent_duplicate_report_usage(self, staff_a, hod, store_keeper):
        """
        Two concurrent report_usage calls on the SAME issued request.
        Status should be 'reported' exactly once; no double effects.
        """
        _setup_chem()
        sc = _client(staff_a)
        hc = _client(hod)
        kc = _client(store_keeper)

        req_id = _create_draft(sc)
        sc.post(f"/api/stock_request/{req_id}/submit/")
        hc.post(f"/api/stock_request/{req_id}/accept/")
        kc.post(f"/api/stock_request/{req_id}/mark_as_issued/")

        sr = StockRequest.objects.get(id=req_id)
        item = sr.chemical_items.first()
        payload = {"items": [{"id": item.id, "actual_used_quantity": "150.00"}]}

        results = run_concurrently([
            lambda: sc.post(f"/api/stock_request/{req_id}/report_usage/", payload, format="json"),
            lambda: sc.post(f"/api/stock_request/{req_id}/report_usage/", payload, format="json"),
        ])

        sr = StockRequest.objects.get(id=req_id)
        assert sr.status == "reported", f"FAIL: status={sr.status}"

        # Item should have actual_used_quantity set exactly once
        item.refresh_from_db()
        assert item.actual_used_quantity == Decimal("150.00"), (
            f"FAIL: actual_used_quantity={item.actual_used_quantity}"
        )


class TestCompleteIdempotency:
    def test_concurrent_duplicate_complete(
        self, staff_a, hod, store_keeper
    ):
        """
        Two concurrent mark_as_completed calls on the SAME reported request.
        Should not create duplicate IssueRegister or IssueChemicals.
        """
        _setup_chem()
        sc = _client(staff_a)
        hc = _client(hod)
        kc = _client(store_keeper)

        req_id = _create_draft(sc)
        sc.post(f"/api/stock_request/{req_id}/submit/")
        hc.post(f"/api/stock_request/{req_id}/accept/")
        kc.post(f"/api/stock_request/{req_id}/mark_as_issued/")

        sr = StockRequest.objects.get(id=req_id)
        item = sr.chemical_items.first()
        sc.post(f"/api/stock_request/{req_id}/report_usage/", {
            "items": [{"id": item.id, "actual_used_quantity": "180.00"}]
        }, format="json")

        qty_before = AvailableChemical.objects.get(chemical_name=CHEM_NAME).quantity

        results = run_concurrently([
            lambda: kc.post(f"/api/stock_request/{req_id}/mark_as_completed/"),
            lambda: kc.post(f"/api/stock_request/{req_id}/mark_as_completed/"),
        ])

        sr = StockRequest.objects.get(id=req_id)
        ir_count = IssueRegister.objects.filter(stock_request_db_id=req_id).count()
        ic_count = IssueChemicals.objects.filter(
            ir__stock_request_db_id=req_id
        ).count()
        qty_after = AvailableChemical.objects.get(chemical_name=CHEM_NAME).quantity

        assert sr.status == "completed", f"FAIL: status={sr.status}"
        assert ir_count == 1, f"FAIL: {ir_count} IssueRegister rows (expected 1)"
        assert ic_count == 1, f"FAIL: {ic_count} IssueChemicals rows (expected 1)"
        # Delta: returned = issued 200 - actual 180 = 20 ml added back
        delta = qty_after - qty_before
        assert delta == Decimal("20.00"), (
            f"FAIL: inventory delta {delta} (expected +20.00). qty {qty_before}->{qty_after}"
        )


class TestAcceptIdempotency:
    def test_concurrent_duplicate_accept(self, staff_a, hod, store_keeper):
        """
        Two concurrent accept calls on the SAME pending request.
        """
        _setup_chem()
        sc = _client(staff_a)
        hc = _client(hod)

        req_id = _create_draft(sc)
        sc.post(f"/api/stock_request/{req_id}/submit/")

        results = run_concurrently([
            lambda: hc.post(f"/api/stock_request/{req_id}/accept/"),
            lambda: hc.post(f"/api/stock_request/{req_id}/accept/"),
        ])

        sr = StockRequest.objects.get(id=req_id)
        assert sr.status == "accepted", f"FAIL: status={sr.status}"


class TestRejectIdempotency:
    def test_concurrent_duplicate_reject(self, staff_a, hod):
        """
        Two concurrent reject calls on the SAME pending request.
        """
        _setup_chem()
        sc = _client(staff_a)
        hc = _client(hod)

        req_id = _create_draft(sc)
        sc.post(f"/api/stock_request/{req_id}/submit/")

        results = run_concurrently([
            lambda: hc.post(f"/api/stock_request/{req_id}/reject/", {
                "rejection_reason": "Duplicate test"
            }, format="json"),
            lambda: hc.post(f"/api/stock_request/{req_id}/reject/", {
                "rejection_reason": "Duplicate test"
            }, format="json"),
        ])

        sr = StockRequest.objects.get(id=req_id)
        assert sr.status == "rejected", f"FAIL: status={sr.status}"
