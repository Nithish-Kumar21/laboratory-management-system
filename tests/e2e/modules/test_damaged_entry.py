"""
E2E Tests: Damaged Entry Module
Module: damaged_entry
Covers: create damage report, apparatus decrement, delete restoration, RBAC
"""
import pytest
import time
from datetime import date
from tests.e2e.conftest import BASE_URL, seed_apparatus
from tests.e2e.page_objects import DamagedEntryPage, NewDamagedEntryPage

pytestmark = [pytest.mark.e2e, pytest.mark.damaged_entry]


# ---------------------------------------------------------------------------
# TC-DMG-001: Create damaged entry
# ---------------------------------------------------------------------------
class TestDamagedEntryCreate:
    @pytest.mark.critical
    def test_create_damaged_entry(self, api_sk):
        """Store Keeper creates a damaged entry."""
        ts = int(time.time())
        app_name = f"DamagedApp-{ts}"
        seed_apparatus(api_sk, app_name, qty=20, reorder=5)
        r = api_sk.post("damaged_entry/", json={
            "staff": "Staff User",
            "class_name": "I B.Sc Chemistry",
            "date": date.today().isoformat(),
            "details": "E2E test damage report",
            "day_order": "I",
            "hour": [1],
            "damaged_items": [
                {"apparatus_name": app_name, "quantity": 3, "caused_by": "Accidental drop"}
            ],
        })
        assert r.status_code == 201, f"Create failed: {r.status_code} {r.text}"

    @pytest.mark.high
    def test_apparatus_decremented_on_damage(self, api_sk):
        """Creating a damaged entry decrements apparatus inventory."""
        ts = int(time.time())
        app_name = f"DecrApp-{ts}"
        seed_apparatus(api_sk, app_name, qty=30, reorder=5)
        # Get initial qty
        r = api_sk.get("available_apparatus/")
        qty_before = 30
        for item in (r.json() if isinstance(r.json(), list) else r.json().get("results", [])):
            if item.get("apparatus_name", "").lower() == app_name.lower():
                qty_before = int(item["available_quantity_pieces"])
        # Create damage
        api_sk.post("damaged_entry/", json={
            "staff": "Staff", "class_name": "I B.Sc Chemistry",
            "date": date.today().isoformat(), "details": "Test", "day_order": "I", "hour": [1],
            "damaged_items": [{"apparatus_name": app_name, "quantity": 5}],
        })
        # Verify qty decreased
        r2 = api_sk.get("available_apparatus/")
        for item in (r2.json() if isinstance(r2.json(), list) else r2.json().get("results", [])):
            if item.get("apparatus_name", "").lower() == app_name.lower():
                assert int(item["available_quantity_pieces"]) == qty_before - 5
                break


# ---------------------------------------------------------------------------
# TC-DMG-002: Delete restores inventory
# ---------------------------------------------------------------------------
class TestDamagedEntryDeleteRestore:
    @pytest.mark.high
    def test_delete_restores_apparatus_qty(self, api_sk):
        """Deleting a damaged entry restores apparatus quantity."""
        ts = int(time.time())
        app_name = f"RestApp-{ts}"
        seed_apparatus(api_sk, app_name, qty=25, reorder=5)
        # Create damage
        r = api_sk.post("damaged_entry/", json={
            "staff": "Staff", "class_name": "I B.Sc Chemistry",
            "date": date.today().isoformat(), "details": "Test", "day_order": "I", "hour": [1],
            "damaged_items": [{"apparatus_name": app_name, "quantity": 4}],
        })
        entry_id = r.json()["id"]
        # Get qty after create
        r1 = api_sk.get("available_apparatus/")
        qty_after_create = 25
        for item in (r1.json() if isinstance(r1.json(), list) else r1.json().get("results", [])):
            if item.get("apparatus_name", "").lower() == app_name.lower():
                qty_after_create = int(item["available_quantity_pieces"])
        # Delete
        api_sk.delete(f"damaged_entry/{entry_id}/")
        # Verify restored
        r2 = api_sk.get("available_apparatus/")
        for item in (r2.json() if isinstance(r2.json(), list) else r2.json().get("results", [])):
            if item.get("apparatus_name", "").lower() == app_name.lower():
                assert int(item["available_quantity_pieces"]) == qty_after_create + 4
                break


# ---------------------------------------------------------------------------
# TC-DMG-003: RBAC — HOD read-only
# ---------------------------------------------------------------------------
class TestDamagedEntryRBAC:
    @pytest.mark.high
    def test_hod_can_view_damaged_entries(self, api_hod):
        """HOD can list damaged entries."""
        r = api_hod.get("damaged_entry/")
        assert r.status_code == 200

    @pytest.mark.high
    def test_hod_cannot_create_damaged_entry(self, api_hod):
        """HOD cannot create damaged entries."""
        r = api_hod.post("damaged_entry/", json={
            "staff": "Test", "class_name": "I B.Sc Chemistry",
            "date": date.today().isoformat(), "details": "", "day_order": "I", "hour": [1],
            "damaged_items": [],
        })
        assert r.status_code == 403

    @pytest.mark.high
    def test_staff_cannot_view_damaged_entries(self, api_staff):
        """Staff cannot list damaged entries."""
        r = api_staff.get("damaged_entry/")
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# TC-DMG-004: UI navigation
# ---------------------------------------------------------------------------
class TestDamagedEntryUI:
    @pytest.mark.medium
    def test_hod_can_navigate_to_damaged_entry(self, login_hod):
        """HOD can navigate to damaged entry list."""
        page = login_hod
        page.goto(f"{BASE_URL}/damaged-entry")
        page.wait_for_load_state("networkidle")
        assert "damaged-entry" in page.url

    @pytest.mark.medium
    def test_sk_can_navigate_to_new_damaged_entry(self, login_sk):
        """Store Keeper can navigate to new damaged entry form."""
        page = login_sk
        page.goto(f"{BASE_URL}/new-damaged-entry")
        page.wait_for_load_state("networkidle")
        assert "new-damaged-entry" in page.url


# ---------------------------------------------------------------------------
# TC-DMG-005: Sorting
# ---------------------------------------------------------------------------
class TestDamagedEntrySorting:
    @pytest.mark.medium
    def test_sort_by_date(self, api_hod):
        """Damaged entries support date ordering."""
        r = api_hod.get("damaged_entry/?ordering=-date")
        assert r.status_code == 200

    @pytest.mark.medium
    def test_sort_by_staff(self, api_hod):
        """Damaged entries support staff ordering."""
        r = api_hod.get("damaged_entry/?ordering=staff")
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# TC-DMG-006: Apparatus names autocomplete
# ---------------------------------------------------------------------------
class TestApparatusAutocomplete:
    @pytest.mark.medium
    def test_apparatus_names_endpoint(self, api_hod):
        """/damaged_entry/apparatus_names/ returns list."""
        r = api_hod.get("damaged_entry/apparatus_names/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
