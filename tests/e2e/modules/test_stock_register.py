"""
E2E Tests: Stock Register Module
Module: stock_register
Covers: create stock entry, duplicate invoice, delete with inventory reversal, RBAC
"""
import pytest
import time
from datetime import date
from tests.e2e.conftest import BASE_URL, seed_chemical, seed_apparatus
from tests.e2e.page_objects import StockRegisterPage, NewStockRegisterPage

pytestmark = [pytest.mark.e2e, pytest.mark.stock_register]


# ---------------------------------------------------------------------------
# TC-SR-001: View stock register
# ---------------------------------------------------------------------------
class TestStockRegisterView:
    @pytest.mark.critical
    def test_hod_can_view_stock_register(self, login_hod):
        """HOD can access the stock register list page."""
        page = login_hod
        page.goto(f"{BASE_URL}/stock-register")
        page.wait_for_load_state("networkidle")
        assert "stock-register" in page.url

    @pytest.mark.high
    def test_staff_cannot_view_stock_register(self, api_staff):
        """Staff receives 403 when accessing stock register API."""
        r = api_staff.get("stock_register/")
        assert r.status_code == 403, f"Staff got {r.status_code}"

    @pytest.mark.high
    def test_sk_can_view_stock_register(self, login_sk):
        """Store Keeper can access stock register."""
        page = login_sk
        page.goto(f"{BASE_URL}/stock-register")
        page.wait_for_load_state("networkidle")
        assert "stock-register" in page.url


# ---------------------------------------------------------------------------
# TC-SR-002: Create stock entry
# ---------------------------------------------------------------------------
class TestStockRegisterCreate:
    @pytest.mark.critical
    def test_create_stock_entry_success(self, api_sk):
        """Store Keeper creates a stock entry with chemical items."""
        ts = int(time.time())
        r = api_sk.post("stock_register/", json={
            "invoice_number": f"INV-E2E-{ts}",
            "date": date.today().isoformat(),
            "supplier_name": "E2E Test Supplier",
            "supplier_contact_country_code": "+91",
            "supplier_contact_phone": "9876543210",
            "chemical_items": [
                {
                    "chemical_name": "E2E Sodium Chloride",
                    "pack_size": "250",
                    "no_of_packs": 2,
                    "unit": "g",
                    "rate": "75.00",
                    "make": "TestMake",
                    "reorder_level": "20",
                }
            ],
            "apparatus_items": [],
        })
        assert r.status_code == 201, f"Create failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("invoice_number") == f"INV-E2E-{ts}"

    @pytest.mark.high
    def test_inventory_increments_on_stock_entry(self, api_sk):
        """Creating a stock entry increments inventory quantity."""
        ts = int(time.time())
        chem_name = f"InvTest-{ts}"
        # Get initial qty (0 if not exists)
        initial = 0
        r_check = api_sk.get(f"available_chemicals/")
        if r_check.ok:
            for item in (r_check.json() if isinstance(r_check.json(), list) else r_check.json().get("results", [])):
                if item.get("chemical_name", "").lower() == chem_name.lower():
                    initial = float(item.get("quantity", 0))

        # Create stock entry
        api_sk.post("stock_register/", json={
            "invoice_number": f"INV-INV-{ts}",
            "date": date.today().isoformat(),
            "supplier_name": "Test Supplier",
            "supplier_contact_country_code": "+91",
            "supplier_contact_phone": "9876543210",
            "chemical_items": [
                {"chemical_name": chem_name, "pack_size": "100", "no_of_packs": 1, "unit": "ml", "rate": "50.00", "make": "Test", "reorder_level": "10"}
            ],
            "apparatus_items": [],
        })

        # Verify qty increased
        r_after = api_sk.get("available_chemicals/")
        if r_after.ok:
            for item in (r_after.json() if isinstance(r_after.json(), list) else r_after.json().get("results", [])):
                if item.get("chemical_name", "").lower() == chem_name.lower():
                    assert float(item["quantity"]) > initial
                    break


# ---------------------------------------------------------------------------
# TC-SR-003: Duplicate invoice number
# ---------------------------------------------------------------------------
class TestDuplicateInvoice:
    @pytest.mark.high
    def test_duplicate_invoice_rejected(self, api_sk):
        """Creating a stock entry with duplicate invoice number fails."""
        ts = int(time.time())
        invoice = f"INV-DUP-{ts}"
        payload = {
            "invoice_number": invoice,
            "date": date.today().isoformat(),
            "supplier_name": "Test",
            "supplier_contact_country_code": "+91",
            "supplier_contact_phone": "9876543210",
            "chemical_items": [
                {"chemical_name": f"DupChem-{ts}", "pack_size": "10", "no_of_packs": 1, "unit": "ml", "rate": "5.00", "make": "X", "reorder_level": "1"}
            ],
            "apparatus_items": [],
        }
        r1 = api_sk.post("stock_register/", json=payload)
        assert r1.status_code == 201
        r2 = api_sk.post("stock_register/", json=payload)
        assert r2.status_code in (400, 409), f"Duplicate should be rejected: {r2.status_code}"


# ---------------------------------------------------------------------------
# TC-SR-004: Admin cannot delete stock register
# ---------------------------------------------------------------------------
class TestAdminDeleteRestriction:
    @pytest.mark.high
    def test_admin_cannot_delete_stock_register(self, api_admin, api_sk):
        """Admin role cannot delete stock register entries."""
        ts = int(time.time())
        r = api_sk.post("stock_register/", json={
            "invoice_number": f"INV-ADM-{ts}",
            "date": date.today().isoformat(),
            "supplier_name": "Test",
            "supplier_contact_country_code": "+91",
            "supplier_contact_phone": "9876543210",
            "chemical_items": [
                {"chemical_name": f"AdminTest-{ts}", "pack_size": "10", "no_of_packs": 1, "unit": "ml", "rate": "5.00", "make": "X", "reorder_level": "1"}
            ],
            "apparatus_items": [],
        })
        if r.status_code == 201:
            entry_id = r.json().get("id")
            del_r = api_admin.delete(f"stock_register/{entry_id}/")
            assert del_r.status_code == 403, f"Admin should not delete: {del_r.status_code}"


# ---------------------------------------------------------------------------
# TC-SR-005: Delete reverses inventory
# ---------------------------------------------------------------------------
class TestDeleteInventoryReversal:
    @pytest.mark.high
    def test_delete_stock_entry_reverses_inventory(self, api_sk):
        """Deleting a stock entry reduces inventory by the entry's quantity."""
        ts = int(time.time())
        chem_name = f"RevTest-{ts}"
        # Create
        r = api_sk.post("stock_register/", json={
            "invoice_number": f"INV-REV-{ts}",
            "date": date.today().isoformat(),
            "supplier_name": "Test",
            "supplier_contact_country_code": "+91",
            "supplier_contact_phone": "9876543210",
            "chemical_items": [
                {"chemical_name": chem_name, "pack_size": "200", "no_of_packs": 1, "unit": "ml", "rate": "50.00", "make": "Test", "reorder_level": "10"}
            ],
            "apparatus_items": [],
        })
        assert r.status_code == 201
        entry_id = r.json().get("id")

        # Check qty before delete
        r_before = api_sk.get("available_chemicals/")
        qty_before = 0
        for item in (r_before.json() if isinstance(r_before.json(), list) else r_before.json().get("results", [])):
            if item.get("chemical_name", "").lower() == chem_name.lower():
                qty_before = float(item["quantity"])
                break

        # Delete
        del_r = api_sk.delete(f"stock_register/{entry_id}/")
        assert del_r.status_code in (200, 204)

        # Check qty after delete
        r_after = api_sk.get("available_chemicals/")
        for item in (r_after.json() if isinstance(r_after.json(), list) else r_after.json().get("results", [])):
            if item.get("chemical_name", "").lower() == chem_name.lower():
                qty_after = float(item["quantity"])
                assert qty_after < qty_before, f"Qty should decrease: {qty_after} < {qty_before}"
                break


# ---------------------------------------------------------------------------
# TC-SR-006: Navigate to new stock register form
# ---------------------------------------------------------------------------
class TestNewStockRegisterUI:
    @pytest.mark.medium
    def test_navigate_to_new_stock_register(self, login_sk):
        """Store Keeper can navigate to new stock register form."""
        page = login_sk
        page.goto(f"{BASE_URL}/new-stock-register")
        page.wait_for_load_state("networkidle")
        assert "new-stock-register" in page.url
        # Form should have inputs
        assert page.locator("input").count() > 0


# ---------------------------------------------------------------------------
# TC-SR-007: Sorting
# ---------------------------------------------------------------------------
class TestStockRegisterSorting:
    @pytest.mark.medium
    def test_sort_by_date_desc(self, api_hod):
        """Stock register list supports date ordering."""
        r = api_hod.get("stock_register/?ordering=-date")
        assert r.status_code == 200

    @pytest.mark.medium
    def test_sort_by_invoice_number(self, api_hod):
        """Stock register list supports invoice_number ordering."""
        r = api_hod.get("stock_register/?ordering=invoice_number")
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# TC-SR-008: Autocomplete endpoints
# ---------------------------------------------------------------------------
class TestAutocompleteEndpoints:
    @pytest.mark.medium
    def test_chemical_names_endpoint(self, api_hod):
        """/stock_register/chemical_names/ returns list of chemicals."""
        r = api_hod.get("stock_register/chemical_names/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.medium
    def test_supplier_names_endpoint(self, api_hod):
        """/stock_register/supplier_names/ returns list."""
        r = api_hod.get("stock_register/supplier_names/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
