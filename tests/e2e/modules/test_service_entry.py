"""
E2E Tests: Service Entry Module
Module: service_entry
Covers: create service entry, action items, complete entry, RBAC
"""
import pytest
import time
from datetime import date, timedelta
from tests.e2e.conftest import BASE_URL, seed_apparatus

pytestmark = [pytest.mark.e2e, pytest.mark.service_entry]


# ---------------------------------------------------------------------------
# TC-SVC-001: Create service entry
# ---------------------------------------------------------------------------
class TestServiceEntryCreate:
    @pytest.mark.high
    def test_create_service_entry(self, api_sk):
        """Store Keeper creates a service entry."""
        ts = int(time.time())
        r = api_sk.post("service-entries/", json={
            "service_code": f"SVC-{ts}",
            "storekeeper": "Store Keeper",
            "service_person_name": "Repair Person",
            "contact_country_code": "+91",
            "contact_number": "9876543210",
            "date": date.today().isoformat(),
            "status": "in_service",
            "items": [
                {
                    "apparatus_name": "Beaker 250ml",
                    "quantity_sent": 5,
                    "quantity_remaining": 5,
                    "quantity_repaired": 0,
                    "quantity_damaged": 0,
                }
            ],
        })
        assert r.status_code == 201, f"Create failed: {r.status_code} {r.text}"

    @pytest.mark.high
    def test_hod_cannot_create_service_entry(self, api_hod):
        """HOD cannot create service entries."""
        r = api_hod.post("service-entries/", json={
            "service_code": "SVC-FAIL",
            "storekeeper": "Test",
            "service_person_name": "Test",
            "contact_country_code": "+91",
            "contact_number": "9876543210",
            "date": date.today().isoformat(),
            "status": "in_service",
            "items": [],
        })
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# TC-SVC-002: List and filter service entries
# ---------------------------------------------------------------------------
class TestServiceEntryList:
    @pytest.mark.medium
    def test_list_service_entries(self, api_sk):
        """Store Keeper can list service entries."""
        r = api_sk.get("service-entries/")
        assert r.status_code == 200

    @pytest.mark.medium
    def test_filter_by_status(self, api_sk):
        """Service entries support status filtering."""
        r = api_sk.get("service-entries/?status=in_service")
        assert r.status_code == 200
        r = api_sk.get("service-entries/?status=completed")
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# TC-SVC-003: RBAC
# ---------------------------------------------------------------------------
class TestServiceEntryRBAC:
    @pytest.mark.high
    def test_staff_cannot_access_service_entries(self, api_staff):
        """Staff cannot list service entries."""
        r = api_staff.get("service-entries/")
        assert r.status_code == 403

    @pytest.mark.high
    def test_hod_can_view_service_entries(self, api_hod):
        """HOD can list service entries."""
        r = api_hod.get("service-entries/")
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# TC-SVC-004: Complete with items still in service blocked
# ---------------------------------------------------------------------------
class TestServiceEntryCompletionGuard:
    @pytest.mark.high
    def test_complete_blocked_if_items_remaining(self, api_sk):
        """Cannot complete service entry if items still have quantity_remaining > 0."""
        ts = int(time.time())
        r = api_sk.post("service-entries/", json={
            "service_code": f"SVC-COMP-{ts}",
            "storekeeper": "SK",
            "service_person_name": "Tech",
            "contact_country_code": "+91",
            "contact_number": "9876543210",
            "date": date.today().isoformat(),
            "status": "in_service",
            "items": [
                {"apparatus_name": "Test Tube", "quantity_sent": 10, "quantity_remaining": 10, "quantity_repaired": 0, "quantity_damaged": 0}
            ],
        })
        entry_id = r.json()["id"]
        r = api_sk.post(f"service-entries/{entry_id}/complete/")
        assert r.status_code == 400, f"Should be blocked: {r.status_code}"


# ---------------------------------------------------------------------------
# TC-SVC-005: Sorting
# ---------------------------------------------------------------------------
class TestServiceEntrySorting:
    @pytest.mark.medium
    def test_sort_by_date(self, api_sk):
        """Service entries support date ordering."""
        r = api_sk.get("service-entries/?ordering=-date")
        assert r.status_code == 200
