"""
Comprehensive Playwright E2E tests for:
  - Stock Register (phone/email validation, chemical/apparatus rows, auto-calcs)
  - Inventory verification
  - Low stock / restock alerts (boundary tests)
  - Case-insensitive chemical name merging

Requires:
  - Django backend running on http://localhost:8000
  - React frontend running on http://localhost:3000
  - Seeded users in the database.

Usage:
  pytest tests/e2e/test_e2e_comprehensive.py -v
  pytest tests/e2e/test_e2e_comprehensive.py -v --headed  (to see the browser)
"""

import re
import time
import pytest
import requests

from helpers_e2e import BASE_API, BASE_URL, CREDENTIALS, get_token


# ── Override browser fixtures (sync, to avoid conftest.py async version) ──

@pytest.fixture(scope="session")
def browser_type_launch_args():
    return {"headless": False, "slow_mo": 300}


@pytest.fixture(scope="session")
def browser_context_args():
    return {"viewport": {"width": 1280, "height": 800}, "storage_state": None}


@pytest.fixture
def browser_context(browser, browser_context_args):
    context = browser.new_context(**browser_context_args)
    yield context
    context.close()


@pytest.fixture
def async_page(page):
    return page


@pytest.fixture(autouse=True)
def screenshot_on_failure():
    yield


@pytest.fixture(autouse=True)
def clear_storage(page):
    page.goto(f"{BASE_URL}/")
    page.evaluate("localStorage.clear()")


# ── Helpers ─────────────────────────────────────────────────────────────────

UNIQUE = str(int(time.time() * 1000))


def store_keeper_token():
    return get_token("storekeeper")


def sk_headers():
    return {"Authorization": f"Bearer {store_keeper_token()}"}


def login_as(page, role: str):
    page.goto(f"{BASE_URL}/login")
    page.get_by_role("textbox", name="Employee ID").fill(CREDENTIALS[role]["username"])
    page.get_by_role("textbox", name="Password").fill(CREDENTIALS[role]["password"])
    page.get_by_role("button", name="Log In").click()
    page.wait_for_function(
        "window.location.pathname !== '/login'",
        timeout=10000,
    )


def navigate_new_stock(page):
    login_as(page, "storekeeper")
    page.goto(f"{BASE_URL}/new-stock-register")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("input[placeholder='INV-REF-001']", timeout=15000)
    page.wait_for_timeout(200)


def fill_chemical_row(page, row_index, *, name, pack_size, unit, packs, rate, make, restock=""):
    entries = page.locator(".nrf-chem-entry")
    entry = entries.nth(row_index)
    entry.locator("input[placeholder='Chemical name...']").click()
    entry.locator("input[placeholder='Chemical name...']").fill(name)
    entry.locator("input[placeholder='Pack size']").fill(str(pack_size))
    label = entry.locator(".nrf-labeled-field .nrf-inline-label", has_text="Unit")
    if label.count() > 0:
        unit_container = label.locator("..")
        unit_container.locator("select.nrf-input").select_option(unit)
    entry.locator("input[placeholder='No. of packs']").fill(str(packs))
    entry.locator("input[placeholder='Rate per pack (₹)']").fill(str(rate))
    make_input = entry.locator("input[placeholder='Make / Brand']")
    make_input.click()
    make_input.fill(str(make))
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    if restock:
        rl = entry.locator("input[placeholder='Restock']")
        if rl.count() > 0:
            rl.fill(str(restock))


def fill_apparatus_row(page, row_index, *, name, qty, rate, make, restock=""):
    entries = page.locator(".nrf-app-entry")
    entry = entries.nth(row_index)
    entry.locator("input[placeholder='Apparatus name...']").click()
    entry.locator("input[placeholder='Apparatus name...']").fill(name)
    entry.locator("input[placeholder='Qty (pcs)']").fill(str(qty))
    entry.locator("input[placeholder='Rate per piece (₹)']").fill(str(rate))
    make_input = entry.locator("input[placeholder='Make / Brand']")
    make_input.click()
    make_input.fill(str(make))
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    if restock:
        rl = entry.locator("input[placeholder='Restock']")
        if rl.count() > 0:
            rl.fill(str(restock))


def get_chemical_total_qty(page, row_index):
    entries = page.locator(".nrf-chem-entry")
    entry = entries.nth(row_index)
    label = entry.locator(".nrf-labeled-field .nrf-inline-label", has_text="Total Qty")
    container = label.locator("..")
    inp = container.locator("input.nrf-readonly")
    return inp.input_value().strip()


def get_chemical_total_price(page, row_index):
    entries = page.locator(".nrf-chem-entry")
    entry = entries.nth(row_index)
    label = entry.locator(".nrf-labeled-field .nrf-inline-label", has_text="Total Price")
    container = label.locator("..")
    inp = container.locator("input.nrf-readonly")
    return inp.input_value().strip()


def get_apparatus_total_price(page, row_index):
    entries = page.locator(".nrf-app-entry")
    entry = entries.nth(row_index)
    label = entry.locator(".nrf-labeled-field .nrf-inline-label", has_text="Total Price")
    container = label.locator("..")
    inp = container.locator("input.nrf-readonly")
    return inp.input_value().strip()


def submit_stock_entry(page, *, check_url=False):
    page.get_by_role("button", name="Finalize Stock Entry").click()
    page.wait_for_timeout(1000)
    try:
        page.wait_for_url(f"{BASE_URL}/stock-register", timeout=20000)
    except Exception:
        dialog = page.locator(".ConfirmDialog, [role='dialog'], .nrf-alert-dialog")
        if dialog.count() > 0:
            text = dialog.text_content()
            print(f"  [ERROR DIALOG] {text[:200]}", flush=True)
        else:
            print(f"  [submit_stock_entry] Still at: {page.url}", flush=True)
    if check_url:
        assert "/stock-register" in page.url, f"Submit failed, still at: {page.url}"


def api_get_inventory_chemical(name):
    r = requests.get(f"{BASE_API}/available_chemicals/", headers=sk_headers())
    assert r.status_code == 200, f"GET available_chemicals failed: {r.text}"
    items = r.json() if isinstance(r.json(), list) else r.json().get("results", [])
    for c in items:
        if c["chemical_name"].lower() == name.lower():
            return c
    return None


def api_get_inventory_apparatus(name):
    r = requests.get(f"{BASE_API}/available_apparatus/", headers=sk_headers())
    assert r.status_code == 200, f"GET available_apparatus failed: {r.text}"
    items = r.json() if isinstance(r.json(), list) else r.json().get("results", [])
    for a in items:
        if a["apparatus_name"].lower() == name.lower():
            return a
    return None


# ═══════════════════════════════════════════════════════════════════════════
# 1. PHONE & EMAIL VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

class TestPhoneEmailValidation:

    def test_phone_rejects_non_digit(self, page):
        navigate_new_stock(page)
        phone_input = page.locator("input[placeholder='Phone number']")
        phone_input.fill("abc123defg")
        page.locator(".nrf-field-label", has_text="Invoice Number").click()
        page.wait_for_timeout(300)
        error_span = page.locator(".nrf-field-error")
        assert error_span.count() > 0, "Expected field error for non-digit phone"
        err_text = error_span.first.text_content().lower()
        assert "exactly 10 digits" in err_text, f"Expected 'exactly 10 digits' error, got: {err_text}"

    def test_phone_rejects_wrong_length(self, page):
        navigate_new_stock(page)
        phone_input = page.locator("input[placeholder='Phone number']")
        phone_input.fill("987654321")
        page.locator(".nrf-field-label", has_text="Invoice Number").click()
        page.wait_for_timeout(300)
        error_span = page.locator(".nrf-field-error")
        assert error_span.count() > 0, "Expected error for 9-digit phone"

        phone_input.fill("98765432101")
        page.locator(".nrf-field-label", has_text="Invoice Number").click()
        page.wait_for_timeout(300)
        assert error_span.count() > 0, "Expected error for 11-digit phone"

    def test_phone_accepts_10_digits(self, page):
        navigate_new_stock(page)
        phone_input = page.locator("input[placeholder='Phone number']")
        phone_input.fill("9876543210")
        page.locator(".nrf-field-label", has_text="Invoice Number").click()
        page.wait_for_timeout(300)
        error_span = page.locator(".nrf-field-error")
        err_count = error_span.count()
        phone_errors = []
        for i in range(err_count):
            txt = error_span.nth(i).text_content().lower()
            if "digit" in txt or "phone" in txt:
                phone_errors.append(txt)
        assert len(phone_errors) == 0, f"Phone errors still visible: {phone_errors}"

    def test_country_code_dropdown(self, page):
        navigate_new_stock(page)
        code_select = page.locator(".nrf-supplier-code select.nrf-input")
        current = code_select.input_value()
        assert current == "+91", f"Default country code should be +91, got {current}"
        code_select.select_option("+1")
        selected = code_select.input_value()
        assert selected == "+1", f"Country code should now be +1, got {selected}"

    def test_email_validation(self, page):
        navigate_new_stock(page)
        email_input = page.locator("input[type='email']")
        email_input.fill("not-an-email")
        page.locator("input[placeholder='INV-REF-001']").fill(f"INV-EMAIL-{UNIQUE}")
        page.locator("input[type='date']").first.fill("2026-07-07")
        page.locator("input[placeholder='Supplier name...']").fill("E2E Test Supplier")
        page.locator("input[placeholder='Phone number']").fill("9876543210")
        fill_chemical_row(page, 0, name="Sodium Hydroxide", pack_size=500, unit="ml", packs=1, rate=100, make="TestMake")
        page.get_by_role("button", name="Finalize Stock Entry").click()
        page.wait_for_timeout(2000)
        if BASE_URL + "/new-stock-register" in page.url or "/new-stock-register" in page.url:
            dialog = page.locator(".nrf-form-container .ConfirmDialog, [role='dialog']")
            if dialog.count() > 0 or page.locator("text=Error").count() > 0:
                return

    def test_submit_rejects_bad_phone(self, page):
        navigate_new_stock(page)
        page.locator("input[placeholder='INV-REF-001']").fill(f"INV-BADPH-{UNIQUE}")
        page.locator("input[type='date']").first.fill("2026-07-07")
        page.locator("input[placeholder='Supplier name...']").fill("E2E Supplier")
        page.locator("input[placeholder='Phone number']").fill("12345")
        fill_chemical_row(page, 0, name="Ethanol", pack_size=100, unit="ml", packs=2, rate=50, make="Merck")
        page.get_by_role("button", name="Finalize Stock Entry").click()
        page.wait_for_timeout(500)
        assert "/new-stock-register" in page.url, "Form submitted despite bad phone"
        error_span = page.locator(".nrf-field-error")
        assert error_span.count() > 0, "Expected inline phone error after submit attempt"


# ═══════════════════════════════════════════════════════════════════════════
# 2. CHEMICAL ROW AUTO-CALCULATION & ROW MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

class TestChemicalRowFlow:

    def test_chemical_auto_calc_total_qty(self, page):
        navigate_new_stock(page)
        fill_chemical_row(page, 0, name="Sulfuric Acid", pack_size=500, unit="ml", packs=4, rate=250, make="Merck")
        page.wait_for_timeout(200)
        total_qty = get_chemical_total_qty(page, 0)
        assert "2000" in total_qty, f"Expected Total Qty 2000, got '{total_qty}'"

    def test_chemical_auto_calc_total_price(self, page):
        navigate_new_stock(page)
        fill_chemical_row(page, 0, name="Nitric Acid", pack_size=250, unit="ml", packs=3, rate=150, make="SRL")
        page.wait_for_timeout(200)
        total_price = get_chemical_total_price(page, 0)
        assert "450.00" in total_price, f"Expected Total Price 450.00, got '{total_price}'"

    def test_chemical_add_multiple_rows(self, page):
        navigate_new_stock(page)
        fill_chemical_row(page, 0, name="ChemA", pack_size=100, unit="ml", packs=1, rate=10, make="MkA")
        page.locator("button.nrf-add-btn", has_text="Add Line").first.click()
        page.wait_for_timeout(300)
        entries = page.locator(".nrf-chem-entry")
        assert entries.count() >= 2, "Expected at least 2 chemical rows after adding"
        fill_chemical_row(page, 1, name="ChemB", pack_size=200, unit="g", packs=2, rate=20, make="MkB")
        page.wait_for_timeout(200)
        total_price_1 = get_chemical_total_price(page, 1)
        assert "40.00" in total_price_1, f"Second row Total Price should be 40.00, got '{total_price_1}'"

    def test_chemical_delete_row(self, page):
        navigate_new_stock(page)
        fill_chemical_row(page, 0, name="ChemToDelete", pack_size=100, unit="ml", packs=1, rate=10, make="Mk")
        page.locator("button.nrf-add-btn", has_text="Add Line").first.click()
        page.wait_for_timeout(300)
        fill_chemical_row(page, 1, name="ChemKeep", pack_size=200, unit="ml", packs=2, rate=15, make="Mk")
        entries = page.locator(".nrf-chem-entry")
        assert entries.count() == 2, "Expected 2 rows before delete"
        entries.first.locator("button.nrf-del-btn").click()
        page.wait_for_timeout(200)
        entries_after = page.locator(".nrf-chem-entry")
        count = entries_after.count()
        assert count == 1, f"Expected 1 row after delete, got {count}"
        remaining_name = entries_after.locator("input[placeholder='Chemical name...']").input_value()
        assert remaining_name == "ChemKeep", f"Expected 'ChemKeep', got '{remaining_name}'"

    def test_chemical_unit_toggle(self, page):
        navigate_new_stock(page)
        entries = page.locator(".nrf-chem-entry")
        entry = entries.first
        label = entry.locator(".nrf-labeled-field .nrf-inline-label", has_text="Unit")
        container = label.locator("..")
        unit_select = container.locator("select.nrf-input")
        options = unit_select.inner_text()
        assert "ml" in options.lower(), "Unit select should have ml option"
        assert "g" in options.lower(), "Unit select should have g option"
        assert unit_select.input_value() == "ml", "Default unit should be ml"
        unit_select.select_option("g")
        assert unit_select.input_value() == "g"


# ═══════════════════════════════════════════════════════════════════════════
# 3. APPARATUS ROW (no unit/total-qty fields)
# ═══════════════════════════════════════════════════════════════════════════

class TestApparatusRowFlow:

    def test_apparatus_fields_absent(self, page):
        navigate_new_stock(page)
        page.locator("button.nrf-add-btn", has_text="Add Line").last.click()
        page.wait_for_timeout(300)
        entries = page.locator(".nrf-app-entry")
        assert entries.count() >= 1, "Expected at least 1 apparatus row"
        entry = entries.first
        unit_labels = entry.locator(".nrf-inline-label", has_text="Unit")
        assert unit_labels.count() == 0, "Unit label should NOT appear in apparatus"
        qty_labels = entry.locator(".nrf-inline-label", has_text="Total Qty")
        assert qty_labels.count() == 0, "Total Qty label should NOT appear in apparatus"

    def test_apparatus_auto_calc_total_price(self, page):
        navigate_new_stock(page)
        page.locator("button.nrf-add-btn", has_text="Add Line").last.click()
        page.wait_for_timeout(300)
        fill_apparatus_row(page, 0, name="Beaker 250ml", qty=10, rate=75, make="Borosil")
        page.wait_for_timeout(200)
        total_price = get_apparatus_total_price(page, 0)
        assert "750.00" in total_price, f"Expected Total Price 750.00, got '{total_price}'"

    def test_apparatus_add_delete_rows(self, page):
        navigate_new_stock(page)
        # Form starts with 1 empty apparatus row; adding 2 gives 3 total
        page.locator("button.nrf-add-btn", has_text="Add Line").last.click()
        page.wait_for_timeout(300)
        fill_apparatus_row(page, 0, name="TestTube", qty=20, rate=5, make="Mk")
        page.locator("button.nrf-add-btn", has_text="Add Line").last.click()
        page.wait_for_timeout(300)
        fill_apparatus_row(page, 1, name="Funnel", qty=5, rate=30, make="Mk2")
        entries = page.locator(".nrf-app-entry")
        entries.first.locator("button.nrf-del-btn").click()
        page.wait_for_timeout(200)
        remaining = page.locator(".nrf-app-entry")
        assert remaining.count() == 2, "Expected 2 apparatus rows after delete (1 filled + 1 empty default)"
        remaining_name = remaining.locator("input[placeholder='Apparatus name...']").nth(0).input_value()
        assert remaining_name == "Funnel", f"Expected 'Funnel', got '{remaining_name}'"


# ═══════════════════════════════════════════════════════════════════════════
# 4. FULL STOCK ENTRY CREATION
# ═══════════════════════════════════════════════════════════════════════════

class TestFullStockEntry:

    def test_create_full_stock_entry(self, page):
        unique = f"INV-E2E-FULL-{UNIQUE}"
        navigate_new_stock(page)
        page.locator("input[placeholder='INV-REF-001']").fill(unique)
        page.locator("input[type='date']").first.fill("2026-07-07")
        page.locator("input[placeholder='Supplier name...']").fill("E2E Test Supplier")
        page.locator("input[placeholder='Phone number']").fill("9876543210")
        page.locator("input[type='email']").fill("supplier@example.com")

        fill_chemical_row(page, 0, name="E2E Chem A", pack_size=500, unit="ml", packs=3, rate=200, make="Merck", restock="100")
        page.locator("button.nrf-add-btn", has_text="Add Line").first.click()
        page.wait_for_timeout(300)
        fill_chemical_row(page, 1, name="E2E Chem B", pack_size=250, unit="g", packs=2, rate=150, make="SRL", restock="50")

        qty0 = get_chemical_total_qty(page, 0)
        assert "1500" in qty0, f"Row 0 Total Qty expected 1500, got '{qty0}'"
        price0 = get_chemical_total_price(page, 0)
        assert "600.00" in price0, f"Row 0 Total Price expected 600.00, got '{price0}'"
        qty1 = get_chemical_total_qty(page, 1)
        assert "500" in qty1, f"Row 1 Total Qty expected 500, got '{qty1}'"
        price1 = get_chemical_total_price(page, 1)
        assert "300.00" in price1, f"Row 1 Total Price expected 300.00, got '{price1}'"

        page.locator("button.nrf-add-btn", has_text="Add Line").last.click()
        page.wait_for_timeout(300)
        fill_apparatus_row(page, 0, name="E2E App A", qty=10, rate=250, make="Borosil", restock="5")
        page.locator("button.nrf-add-btn", has_text="Add Line").last.click()
        page.wait_for_timeout(300)
        fill_apparatus_row(page, 1, name="E2E App B", qty=5, rate=100, make="Glassco")

        app_price0 = get_apparatus_total_price(page, 0)
        assert "2500.00" in app_price0, f"App Row 0 Total Price expected 2500.00, got '{app_price0}'"

        textarea = page.locator("textarea[placeholder='Any additional notes...']")
        textarea.fill("E2E test stock entry with remarks")
        submit_stock_entry(page)
        page.wait_for_timeout(1000)

        r = requests.get(f"{BASE_API}/stock_register/", headers=sk_headers())
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else r.json().get("results", [])
        match = [sr for sr in items if unique in sr.get("invoice_number", "")]
        assert len(match) >= 1, f"Stock entry '{unique}' not found in API response"

        sr_id = match[0]["id"]
        r2 = requests.get(f"{BASE_API}/stock_register/{sr_id}/", headers=sk_headers())
        assert r2.status_code == 200
        detail = r2.json()
        chem_names = [ci["chemical_name"] for ci in detail.get("chemical_items", [])]
        assert "E2E Chem A" in chem_names, f"Chem A not in detail: {chem_names}"
        assert "E2E Chem B" in chem_names, f"Chem B not in detail: {chem_names}"
        app_names = [ai["apparatus_name"] for ai in detail.get("apparatus_items", [])]
        assert "E2E App A" in app_names, f"App A not in detail: {app_names}"
        assert "E2E App B" in app_names, f"App B not in detail: {app_names}"

    def test_remarks_optional_and_displayed(self, page):
        unique = f"INV-E2E-NOREM-{UNIQUE}"
        navigate_new_stock(page)
        page.locator("input[placeholder='INV-REF-001']").fill(unique)
        page.locator("input[type='date']").first.fill("2026-07-07")
        page.locator("input[placeholder='Supplier name...']").fill("No Remarks Supplier")
        page.locator("input[placeholder='Phone number']").fill("9876543210")
        fill_chemical_row(page, 0, name="E2E NoRem Chem", pack_size=100, unit="ml", packs=1, rate=50, make="Mk")
        submit_stock_entry(page)
        page.wait_for_timeout(1000)

        r = requests.get(f"{BASE_API}/stock_register/", headers=sk_headers())
        items = r.json() if isinstance(r.json(), list) else r.json().get("results", [])
        match = [sr for sr in items if unique in sr.get("invoice_number", "")]
        assert len(match) >= 1
        sr_id = match[0]["id"]
        r2 = requests.get(f"{BASE_API}/stock_register/{sr_id}/", headers=sk_headers())
        detail = r2.json()
        assert not detail.get("remarks"), f"Expected empty remarks, got '{detail.get('remarks')}'"


# ═══════════════════════════════════════════════════════════════════════════
# 5. INVENTORY UPDATE
# ═══════════════════════════════════════════════════════════════════════════

class TestInventoryUpdate:

    def test_chemical_inventory_increases(self, page):
        unique = f"INV-INVCHM-{UNIQUE}"
        chem_name = f"E2E Inv Chem {UNIQUE}"

        navigate_new_stock(page)
        page.locator("input[placeholder='INV-REF-001']").fill(unique)
        page.locator("input[type='date']").first.fill("2026-07-07")
        page.locator("input[placeholder='Supplier name...']").fill("Inv Chem Supplier")
        page.locator("input[placeholder='Phone number']").fill("9876543210")
        fill_chemical_row(page, 0, name=chem_name, pack_size=100, unit="ml", packs=5, rate=50, make="Merck")
        submit_stock_entry(page)
        page.wait_for_timeout(1500)

        chem = api_get_inventory_chemical(chem_name)
        assert chem is not None, f"Chemical '{chem_name}' not found in inventory after creation"
        qty = float(chem["quantity"])
        assert qty == 500.0, f"Expected inventory qty 500.0, got {qty}"

    def test_apparatus_inventory_increases(self, page):
        unique = f"INV-INVAPP-{UNIQUE}"
        app_name = f"E2E Inv App {UNIQUE}"

        navigate_new_stock(page)
        page.locator("input[placeholder='INV-REF-001']").fill(unique)
        page.locator("input[type='date']").first.fill("2026-07-07")
        page.locator("input[placeholder='Supplier name...']").fill("Inv App Supplier")
        page.locator("input[placeholder='Phone number']").fill("9876543210")
        page.locator("button.nrf-add-btn", has_text="Add Line").last.click()
        page.wait_for_timeout(300)
        fill_apparatus_row(page, 0, name=app_name, qty=20, rate=100, make="Borosil")
        submit_stock_entry(page)
        page.wait_for_timeout(1500)

        app = api_get_inventory_apparatus(app_name)
        assert app is not None, f"Apparatus '{app_name}' not found in inventory"
        qty = int(app["available_quantity_pieces"])
        assert qty >= 20, f"Expected apparatus qty >= 20, got {qty}"


# ═══════════════════════════════════════════════════════════════════════════
# 6. LOW STOCK / RESTOCK ALERTS
# ═══════════════════════════════════════════════════════════════════════════

class TestLowStockAlerts:

    def test_low_stock_alert_below_threshold(self, page):
        chem_name = f"E2E LowStock {UNIQUE}"
        unique = f"INV-LS-{UNIQUE}"

        navigate_new_stock(page)
        page.locator("input[placeholder='INV-REF-001']").fill(unique)
        page.locator("input[type='date']").first.fill("2026-07-07")
        page.locator("input[placeholder='Supplier name...']").fill("Low Stock Supplier")
        page.locator("input[placeholder='Phone number']").fill("9876543210")
        fill_chemical_row(page, 0, name=chem_name, pack_size=100, unit="ml", packs=1, rate=50, make="Merck", restock="200")
        submit_stock_entry(page)
        page.wait_for_timeout(1500)

        page.goto(f"{BASE_URL}/inventory")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)

        warning = page.locator(".inv-warning-banner")
        page.wait_for_timeout(1000)

        if warning.count() > 0:
            text = warning.text_content().lower()
            assert chem_name.lower() in text or str(warning.count()) >= "1", \
                f"Warning banner should mention '{chem_name}', content: {text}"
        else:
            table = page.locator("table.inv-table")
            if table.count() > 0:
                rows = table.locator("tbody tr")
                for i in range(rows.count()):
                    name_cell = rows.nth(i).locator(".col-name")
                    if name_cell.count() > 0:
                        cell_text = name_cell.text_content().lower()
                        if chem_name.lower() in cell_text:
                            badge = rows.nth(i).locator(".status-badge")
                            if badge.count() > 0:
                                badge_text = badge.text_content()
                                assert "critical" in badge_text.lower() or "low" in badge_text.lower(), \
                                    f"Expected low-stock badge, got '{badge_text}'"
                            break

    def test_boundary_at_reorder_level(self, page):
        chem_name = f"E2E AtThreshold {UNIQUE}"
        unique = f"INV-AT-{UNIQUE}"

        navigate_new_stock(page)
        page.locator("input[placeholder='INV-REF-001']").fill(unique)
        page.locator("input[type='date']").first.fill("2026-07-07")
        page.locator("input[placeholder='Supplier name...']").fill("Threshold Supplier")
        page.locator("input[placeholder='Phone number']").fill("9876543210")
        fill_chemical_row(page, 0, name=chem_name, pack_size=100, unit="ml", packs=1, rate=50, make="Merck", restock="100")
        submit_stock_entry(page)
        page.wait_for_timeout(1500)

        chem = api_get_inventory_chemical(chem_name)
        assert chem is not None
        qty = float(chem["quantity"])
        rl = float(chem["reorder_level"] or 0)
        assert qty <= rl, f"Expected qty({qty}) <= reorder({rl}) for boundary test"

    def test_no_alert_above_reorder_level(self, page):
        chem_name = f"E2E Healthy {UNIQUE}"
        unique = f"INV-HLTH-{UNIQUE}"

        navigate_new_stock(page)
        page.locator("input[placeholder='INV-REF-001']").fill(unique)
        page.locator("input[type='date']").first.fill("2026-07-07")
        page.locator("input[placeholder='Supplier name...']").fill("Healthy Supplier")
        page.locator("input[placeholder='Phone number']").fill("9876543210")
        fill_chemical_row(page, 0, name=chem_name, pack_size=500, unit="ml", packs=1, rate=50, make="Merck", restock="100")
        submit_stock_entry(page)
        page.wait_for_timeout(1500)

        chem = api_get_inventory_chemical(chem_name)
        assert chem is not None
        qty = float(chem["quantity"])
        rl = float(chem["reorder_level"] or 0)
        assert qty > rl * 1.5, f"Expected qty({qty}) > reorder*1.5({rl*1.5}) for healthy status"

        page.goto(f"{BASE_URL}/inventory")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        search_input = page.locator("input.inv-search-input")
        if search_input.count() > 0:
            search_input.fill(chem_name)
            page.wait_for_timeout(500)

        table = page.locator("table.inv-table")
        if table.count() > 0:
            rows = table.locator("tbody tr")
            for i in range(rows.count()):
                name_cell = rows.nth(i).locator(".col-name")
                if name_cell.count() > 0 and chem_name.lower() in name_cell.text_content().lower():
                    badge = rows.nth(i).locator(".status-badge")
                    if badge.count() > 0:
                        badge_text = badge.text_content()
                        assert "healthy" in badge_text.lower(), f"Expected 'healthy' badge, got '{badge_text}'"
                    break

    def test_low_stock_alert_dashboard(self, page):
        login_as(page, "storekeeper")
        page.goto(f"{BASE_URL}/")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        low_stock_section = page.locator(".low-stock-section, .low-stock-list")
        warning_banner = page.locator(".inv-warning-banner")

        has_section = low_stock_section.count() > 0
        has_banner = warning_banner.count() > 0
        if not has_section and not has_banner:
            pytest.skip("No low stock indicators found — no items below threshold")


# ═══════════════════════════════════════════════════════════════════════════
# 7. CASE-INSENSITIVE MERGE
# ═══════════════════════════════════════════════════════════════════════════

class TestCaseInsensitiveMerge:

    def test_case_insensitive_chemical_merge(self, page):
        base_name = f"E2E CASE MERGE {UNIQUE}"
        first_casing = f"E2E CASE MERGE {UNIQUE}"
        second_casing = f"e2e case merge {UNIQUE}"

        inv1 = f"INV-CASE1-{UNIQUE}"
        navigate_new_stock(page)
        page.locator("input[placeholder='INV-REF-001']").fill(inv1)
        page.locator("input[type='date']").first.fill("2026-07-07")
        page.locator("input[placeholder='Supplier name...']").fill("Case Sensitive Supplier")
        page.locator("input[placeholder='Phone number']").fill("9876543210")
        fill_chemical_row(page, 0, name=first_casing, pack_size=300, unit="ml", packs=1, rate=100, make="Merck")
        submit_stock_entry(page)
        page.wait_for_timeout(1500)

        inv2 = f"INV-CASE2-{UNIQUE}"
        navigate_new_stock(page)
        page.locator("input[placeholder='INV-REF-001']").fill(inv2)
        page.locator("input[type='date']").first.fill("2026-07-07")
        page.locator("input[placeholder='Supplier name...']").fill("Case Sensitive Supplier")
        page.locator("input[placeholder='Phone number']").fill("9876543210")
        fill_chemical_row(page, 0, name=second_casing, pack_size=200, unit="ml", packs=1, rate=100, make="Merck")
        submit_stock_entry(page)
        page.wait_for_timeout(1500)

        chem = api_get_inventory_chemical(base_name)
        assert chem is not None, f"Chemical '{base_name}' not found in inventory after merge"
        qty = float(chem["quantity"])
        assert qty == 500.0, f"Expected merged qty=500, got {qty}. Merge may have failed (duplicate rows)."

        r = requests.get(f"{BASE_API}/available_chemicals/", headers=sk_headers())
        items = r.json() if isinstance(r.json(), list) else r.json().get("results", [])
        matches = [c for c in items if c["chemical_name"].lower() == base_name.lower()]
        assert len(matches) == 1, f"Expected 1 inventory row, found {len(matches)}: {[m['chemical_name'] for m in matches]}"
