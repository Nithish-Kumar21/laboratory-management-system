"""
E2E Tests: Cross-Module Integration
Covers: inventory sync across modules, audit trail continuity, notification triggers
"""
import pytest
import time
from datetime import date
from tests.e2e.conftest import BASE_URL, APIClient, seed_chemical, seed_apparatus, create_stock_request

pytestmark = [pytest.mark.e2e, pytest.mark.cross_module]


# ---------------------------------------------------------------------------
# TC-XMOD-001: Stock Register → Inventory → Stock Request → Inventory
# ---------------------------------------------------------------------------
class TestStockRegisterToRequest:
    @pytest.mark.critical
    def test_add_then_consume_chemical(self, api_sk, api_staff, api_hod):
        """Stock entry adds chemical, stock request consumes it, completion adjusts inventory correctly."""
        ts = int(time.time())
        chem = f"CrossMod-{ts}"

        # 1. Add via stock register
        seed_chemical(api_sk, chem, qty=1000, reorder=50)
        r = api_sk.get("available_chemicals/")
        qty_after_add = 0
        for item in (r.json() if isinstance(r.json(), list) else r.json().get("results", [])):
            if item.get("chemical_name", "").lower() == chem.lower():
                qty_after_add = float(item["quantity"])
                break
        assert qty_after_add == 1000.0

        # 2. Create and process request (full lifecycle)
        r = create_stock_request(api_staff, chemical_items=[
            {"chemical_name": chem, "quantity": "300", "unit": "ml"}
        ])
        req_id = r.json()["id"]
        api_staff.post(f"stock_request/{req_id}/submit/")
        api_hod.post(f"stock_request/{req_id}/accept/")
        api_sk.post(f"stock_request/{req_id}/mark_as_issued/")

        # 3. Check inventory after issue
        r = api_sk.get("available_chemicals/")
        qty_after_issue = 0
        for item in (r.json() if isinstance(r.json(), list) else r.json().get("results", [])):
            if item.get("chemical_name", "").lower() == chem.lower():
                qty_after_issue = float(item["quantity"])
                break
        assert qty_after_issue == 700.0, f"Expected 700 after issue, got {qty_after_issue}"

        # 4. Report usage and complete
        r_detail = api_staff.get(f"stock_request/{req_id}/")
        chem_items = r_detail.json().get("chemical_items", [])
        items_payload = [{"id": ci["id"], "actual_used_quantity": "200"} for ci in chem_items]
        api_staff.post(f"stock_request/{req_id}/report_usage/", json={"items": items_payload})
        api_sk.post(f"stock_request/{req_id}/mark_as_completed/")

        # 5. Final check: 700 + 100 returned = 800
        r = api_sk.get("available_chemicals/")
        qty_final = 0
        for item in (r.json() if isinstance(r.json(), list) else r.json().get("results", [])):
            if item.get("chemical_name", "").lower() == chem.lower():
                qty_final = float(item["quantity"])
                break
        assert qty_final == 800.0, f"Expected 800 final, got {qty_final}"


# ---------------------------------------------------------------------------
# TC-XMOD-002: Damaged Entry → Inventory sync
# ---------------------------------------------------------------------------
class TestDamageToInventory:
    @pytest.mark.high
    def test_damage_decrements_and_delete_restores(self, api_sk):
        """Damage report decrements apparatus; deleting it restores the quantity."""
        ts = int(time.time())
        app = f"XModApp-{ts}"
        seed_apparatus(api_sk, app, qty=100, reorder=10)
        r = api_sk.get("available_apparatus/")
        initial = 100
        for item in (r.json() if isinstance(r.json(), list) else r.json().get("results", [])):
            if item.get("apparatus_name", "").lower() == app.lower():
                initial = int(item["available_quantity_pieces"])

        # Create damage
        r = api_sk.post("damaged_entry/", json={
            "staff": "XMod Staff", "class_name": "I B.Sc Chemistry",
            "date": date.today().isoformat(), "details": "", "day_order": "I", "hour": [1],
            "damaged_items": [{"apparatus_name": app, "quantity": 15}],
        })
        entry_id = r.json()["id"]
        r = api_sk.get("available_apparatus/")
        after_damage = initial
        for item in (r.json() if isinstance(r.json(), list) else r.json().get("results", [])):
            if item.get("apparatus_name", "").lower() == app.lower():
                after_damage = int(item["available_quantity_pieces"])
        assert after_damage == initial - 15

        # Delete
        api_sk.delete(f"damaged_entry/{entry_id}/")
        r = api_sk.get("available_apparatus/")
        after_delete = 0
        for item in (r.json() if isinstance(r.json(), list) else r.json().get("results", [])):
            if item.get("apparatus_name", "").lower() == app.lower():
                after_delete = int(item["available_quantity_pieces"])
        assert after_delete == initial


# ---------------------------------------------------------------------------
# TC-XMOD-003: Audit trail across modules
# ---------------------------------------------------------------------------
class TestAuditTrailContinuity:
    @pytest.mark.high
    def test_full_workflow_creates_audit_trail(self, api_sk, api_staff, api_hod):
        """A full stock request lifecycle creates audit entries at each step."""
        ts = int(time.time())
        chem = f"AuditTrail-{ts}"
        seed_chemical(api_sk, chem, qty=500, reorder=10)
        r = create_stock_request(api_staff, chemical_items=[
            {"chemical_name": chem, "quantity": "50", "unit": "ml"}
        ])
        req_id = r.json()["id"]

        api_staff.post(f"stock_request/{req_id}/submit/")
        api_hod.post(f"stock_request/{req_id}/accept/")
        api_sk.post(f"stock_request/{req_id}/mark_as_issued/")

        # Report + complete
        r_detail = api_staff.get(f"stock_request/{req_id}/")
        ci = r_detail.json().get("chemical_items", [])
        api_staff.post(f"stock_request/{req_id}/report_usage/", json={"items": [{"id": x["id"], "actual_used_quantity": "30"} for x in ci]})
        api_sk.post(f"stock_request/{req_id}/mark_as_completed/")

        # Check audit trail
        r_audit = api_hod.get("audit-logs/")
        data = r_audit.json() if isinstance(r_audit.json(), list) else r_audit.json().get("results", [])
        req_entries = [e for e in data if str(e.get("entity_id")) == str(req_id)]
        actions = {e["action"] for e in req_entries}
        expected = {"REQUEST_CREATED", "REQUEST_SUBMITTED", "REQUEST_ACCEPTED", "REQUEST_ISSUED", "USAGE_REPORTED", "REQUEST_COMPLETED"}
        assert expected.issubset(actions), f"Missing audit actions: {expected - actions}"


# ---------------------------------------------------------------------------
# TC-XMOD-004: Issue Register created after completion
# ---------------------------------------------------------------------------
class TestIssueRegisterSync:
    @pytest.mark.high
    def test_issue_register_linked_to_request(self, api_sk, api_staff, api_hod):
        """Completion creates an IssueRegister entry linked to the stock request."""
        ts = int(time.time())
        chem = f"IssueSync-{ts}"
        seed_chemical(api_sk, chem, qty=500, reorder=10)
        r = create_stock_request(api_staff, chemical_items=[
            {"chemical_name": chem, "quantity": "80", "unit": "ml"}
        ])
        req_id = r.json()["id"]
        api_staff.post(f"stock_request/{req_id}/submit/")
        api_hod.post(f"stock_request/{req_id}/accept/")
        api_sk.post(f"stock_request/{req_id}/mark_as_issued/")

        r_detail = api_staff.get(f"stock_request/{req_id}/")
        ci = r_detail.json().get("chemical_items", [])
        api_staff.post(f"stock_request/{req_id}/report_usage/", json={"items": [{"id": x["id"], "actual_used_quantity": "60"} for x in ci]})
        api_sk.post(f"stock_request/{req_id}/mark_as_completed/")

        # Check issue register
        r_ir = api_sk.get("issue_register/")
        data = r_ir.json() if isinstance(r_ir.json(), list) else r_ir.json().get("results", [])
        linked = [e for e in data if str(e.get("stock_request_db_id")) == str(req_id)]
        assert len(linked) > 0, f"No IssueRegister entry for request {req_id}"
        assert linked[0]["status"] == "completed"


# ---------------------------------------------------------------------------
# TC-XMOD-005: Low stock notification data consistency
# ---------------------------------------------------------------------------
class TestLowStockConsistency:
    @pytest.mark.medium
    def test_low_stock_endpoint_matches_inventory(self, api_hod):
        """Low stock chemicals endpoint returns items below reorder level."""
        r_chem = api_hod.get("available_chemicals/")
        r_low = api_hod.get("low_stock_chemicals/")
        if r_chem.ok and r_low.ok:
            all_chems = r_chem.json() if isinstance(r_chem.json(), list) else r_chem.json().get("results", [])
            low_chems = r_low.json() if isinstance(r_low.json(), list) else r_low.json().get("results", [])
            for lc in low_chems:
                matching = next((c for c in all_chems if c["chemical_name"] == lc["chemical_name"]), None)
                assert matching is not None
                assert float(matching["quantity"]) <= float(matching.get("reorder_level", float("inf")))
