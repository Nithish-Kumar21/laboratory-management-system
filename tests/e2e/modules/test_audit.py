"""
E2E Tests: Audit Log Module
Module: audit
Covers: immutability, role-based visibility, action coverage
"""
import pytest
from tests.e2e.conftest import BASE_URL

pytestmark = [pytest.mark.e2e, pytest.mark.audit]


# ---------------------------------------------------------------------------
# TC-AUD-001: HOD can view all audit logs
# ---------------------------------------------------------------------------
class TestAuditLogAccess:
    @pytest.mark.critical
    def test_hod_can_list_audit_logs(self, api_hod):
        """HOD can list all audit log entries."""
        r = api_hod.get("audit-logs/")
        assert r.status_code == 200

    @pytest.mark.high
    def test_staff_limited_view(self, api_staff):
        """Staff can view audit logs (limited to own request actions)."""
        r = api_staff.get("audit-logs/")
        assert r.status_code == 200

    @pytest.mark.high
    def test_store_keeper_limited_view(self, api_sk):
        """Store Keeper can view audit logs (limited to stock/request actions)."""
        r = api_sk.get("audit-logs/")
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# TC-AUD-002: Immutability — no write endpoints
# ---------------------------------------------------------------------------
class TestAuditLogImmutability:
    @pytest.mark.high
    def test_cannot_delete_audit_log(self, api_hod):
        """DELETE on audit logs is not allowed."""
        r = api_hod.delete("audit-logs/1/")
        assert r.status_code in (404, 405)

    @pytest.mark.high
    def test_cannot_update_audit_log(self, api_hod):
        """PUT/PATCH on audit logs is not allowed."""
        r = api_hod.put("audit-logs/1/", json={"description": "tampered"})
        assert r.status_code in (404, 405)
        r = api_hod.patch("audit-logs/1/", json={"description": "tampered"})
        assert r.status_code in (404, 405)


# ---------------------------------------------------------------------------
# TC-AUD-003: Login creates audit entry
# ---------------------------------------------------------------------------
class TestAuditLogOnLogin:
    @pytest.mark.high
    def test_login_creates_audit_entry(self, api_hod):
        """Successful login creates an audit log entry."""
        r = api_hod.get("audit-logs/")
        assert r.status_code == 200
        data = r.json() if isinstance(r.json(), list) else r.json().get("results", [])
        login_entries = [e for e in data if e.get("action") == "LOGIN_SUCCESS"]
        assert len(login_entries) > 0, "No LOGIN_SUCCESS audit entry found"


# ---------------------------------------------------------------------------
# TC-AUD-004: Stock request actions logged
# ---------------------------------------------------------------------------
class TestAuditLogOnStockActions:
    @pytest.mark.high
    def test_request_created_logged(self, api_staff, api_hod, api_sk):
        """Creating a stock request creates an audit entry."""
        from tests.e2e.conftest import create_stock_request
        import time
        ts = int(time.time())
        r = create_stock_request(api_staff, chemical_items=[
            {"chemical_name": "Hydrochloric Acid", "quantity": "10", "unit": "ml"}
        ])
        req_id = r.json()["id"]
        # Check audit
        r_audit = api_hod.get("audit-logs/")
        data = r_audit.json() if isinstance(r_audit.json(), list) else r_audit.json().get("results", [])
        created_entries = [e for e in data if e.get("action") == "REQUEST_CREATED" and str(e.get("entity_id")) == str(req_id)]
        assert len(created_entries) > 0
        # Clean up
        api_staff.post(f"stock_request/{req_id}/submit/")
        api_hod.post(f"stock_request/{req_id}/reject/", json={"rejection_reason": "E2E test cleanup"})


# ---------------------------------------------------------------------------
# TC-AUD-005: Audit log entries have required fields
# ---------------------------------------------------------------------------
class TestAuditLogSchema:
    @pytest.mark.medium
    def test_audit_entry_has_required_fields(self, api_hod):
        """Each audit entry contains required fields."""
        r = api_hod.get("audit-logs/")
        data = r.json() if isinstance(r.json(), list) else r.json().get("results", [])
        if len(data) > 0:
            entry = data[0]
            assert "action" in entry
            assert "entity_type" in entry
            assert "timestamp" in entry
            assert "description" in entry
