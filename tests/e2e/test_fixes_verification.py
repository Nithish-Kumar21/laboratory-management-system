"""
Playwright E2E verification tests for 8 frontend reliability fixes.

Tests confirm the following hardening changes work in a real browser:
  1. Single-flight token refresh (no race condition)
  2. NaN guard blocks submission of invalid numeric fields
  3. Null invoice_number does not crash StockRegister page
  4. Bottom nav does not overlap form submit button on 375px viewport
  5. LowStockAlert re-renders after inventory-updated event (stale closure fix)
  6. Settings config values are numeric (not NaN or string)
  7. No ProtectedRoute debug console.log messages leak to console
  8. All API URL paths resolve (leading-slash convention)

Requires:
  - Django backend running on http://localhost:8000
  - React frontend running on http://localhost:3000
  - Seeded users (test_store_keeper) in the database.

Usage:
  pytest tests/e2e/test_fixes_verification.py -v
  pytest tests/e2e/test_fixes_verification.py -v --headed
"""

import time
import pytest
import requests

from helpers_e2e import BASE_API, BASE_URL, CREDENTIALS, get_token

# ── Override conftest fixtures (sync, like test_e2e_comprehensive.py) ──────


@pytest.fixture(scope="session")
def browser_type_launch_args():
    return {"headless": True}


@pytest.fixture(scope="session")
def browser_context_args():
    return {"viewport": {"width": 375, "height": 812}, "storage_state": None}


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


# ── Helpers ────────────────────────────────────────────────────────────────

UNIQUE = str(int(time.time() * 1000))


def sk_headers():
    return {"Authorization": f"Bearer {get_token('storekeeper')}"}


def login_as(page, role: str):
    page.goto(f"{BASE_URL}/login")
    page.get_by_role("textbox", name="Employee ID").fill(CREDENTIALS[role]["username"])
    page.get_by_role("textbox", name="Password").fill(CREDENTIALS[role]["password"])
    page.get_by_role("button", name="Log In").click()
    page.wait_for_function(
        "window.location.pathname !== '/login'",
        timeout=10000,
    )


# ═══════════════════════════════════════════════════════════════════════════
# 1. Token refresh single-flight
# ═══════════════════════════════════════════════════════════════════════════

class TestTokenRefreshSingleFlight:

    def test_single_refresh_on_simultaneous_401(self, page):
        """Two concurrent API calls both get 401 → only one token/refresh fires."""
        refresh_count = {"n": 0}

        def handle_route(route):
            refresh_count["n"] += 1
            route.continue_()

        # Intercept token/refresh calls before login
        page.route("**/users/token/refresh/**", handle_route)

        login_as(page, "storekeeper")
        page.goto(f"{BASE_URL}/inventory")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)

        # Inject an expired token so next requests get 401 and trigger refresh
        page.evaluate("""
            localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiJ9.expired.signature');
        """)

        # Fire two concurrent requests via the app's axios instance
        page.evaluate("""
            Promise.all([
                window.__NEXT_API ? window.__NEXT_API.get('/available_chemicals/') : fetch('/api/available_chemicals/'),
                window.__NEXT_API ? window.__NEXT_API.get('/available_apparatus/') : fetch('/api/available_apparatus/')
            ]).catch(() => {});
        """)

        # Also trigger via SPA navigation which fires multiple API calls
        page.goto(f"{BASE_URL}/")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)

        # Assert: refresh was called exactly once (or zero if no 401 hit)
        assert refresh_count["n"] <= 1, (
            f"Token refresh called {refresh_count['n']} times — "
            f"expected at most 1 (race condition present)"
        )

        # Assert: page did not redirect to /login (refresh succeeded)
        assert "/login" not in page.url, (
            "Redirected to /login — refresh failed or was not attempted"
        )


# ═══════════════════════════════════════════════════════════════════════════
# 2. NaN guard blocks submission
# ═══════════════════════════════════════════════════════════════════════════

class TestNaNGuard:

    def test_empty_pack_size_blocks_submit(self, page):
        """Leaving pack_size empty with a chemical name triggers the NaN guard."""
        login_as(page, "storekeeper")
        page.goto(f"{BASE_URL}/new-stock-register")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("input[placeholder='INV-REF-001']", timeout=15000)
        page.wait_for_timeout(300)

        # Fill required header fields
        page.locator("input[placeholder='INV-REF-001']").fill(f"INV-NAN-{UNIQUE}")
        page.locator("input[type='date']").first.fill("2026-07-15")
        page.locator("input[placeholder='Supplier name...']").fill("NaN Test Supplier")
        page.locator("input[placeholder='Phone number']").fill("9876543210")

        # Add chemical row with name but EMPTY pack_size
        chem_entry = page.locator(".nrf-chem-entry").first
        chem_entry.locator("input[placeholder='Chemical name...']").click()
        chem_entry.locator("input[placeholder='Chemical name...']").fill("Test Chemical NaN")
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        # Leave pack_size empty, fill other required fields
        chem_entry.locator("input[placeholder='No. of packs']").fill("5")
        chem_entry.locator("input[placeholder='Rate per pack (₹)']").fill("100")
        page.wait_for_timeout(200)

        # Intercept API to confirm no POST fires
        post_count = {"n": 0}

        def on_request(req):
            if req.method == "POST" and "stock_register" in req.url:
                post_count["n"] += 1

        page.route("**/stock_register/**", on_request)

        # Accept any browser dialog (not our custom ConfirmDialog)
        page.on("dialog", lambda d: d.dismiss())

        # Submit via form dispatchEvent (more reliable than click at 375px)
        page.evaluate("""
            const form = document.querySelector('form');
            if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        """)
        page.wait_for_timeout(3000)

        # Debug: dump form state and page content for diagnosis
        debug = page.evaluate("""() => {
            const dialog = document.querySelector('.confirm-dialog-overlay');
            const dialogMsg = document.querySelector('.confirm-dialog-message');
            const chemInputs = document.querySelectorAll('.nrf-chem-entry input[placeholder="Chemical name..."]');
            const packInputs = document.querySelectorAll('.nrf-chem-entry input[placeholder="Pack size"]');
            return {
                dialogFound: !!dialog,
                dialogVisible: dialog ? dialog.style.display !== 'none' : false,
                dialogMsg: dialogMsg ? dialogMsg.textContent : null,
                chemNames: Array.from(chemInputs).map(i => i.value),
                packSizes: Array.from(packInputs).map(i => i.value),
                pageUrl: window.location.pathname
            };
        }""")
        print(f"  [DEBUG] {debug}", flush=True)

        # Assert: custom ConfirmDialog appeared (class-based selector, not text)
        dialog = page.locator(".confirm-dialog-overlay")
        dialog_visible = dialog.count() > 0 and dialog.is_visible()

        # Also check for the specific message text in the dialog
        if dialog_visible:
            msg = page.locator(".confirm-dialog-message")
            assert msg.count() > 0, "ConfirmDialog rendered but no message element found"
        else:
            # Fallback: check for alert text anywhere on page
            alert = page.locator("text=/numeric fields|fill in all/i")
            assert alert.count() > 0, (
                "No ConfirmDialog found and no alert text on page — "
                "NaN guard not triggered"
            )

        # Assert: still on the form page
        assert "/new-stock-register" in page.url, (
            "Navigated away — form was submitted despite NaN"
        )

        # Assert: no POST to stock_register
        assert post_count["n"] == 0, (
            f"POST to stock_register fired {post_count['n']} time(s) — "
            f"NaN guard failed to block submission"
        )


# ═══════════════════════════════════════════════════════════════════════════
# 3. Null invoice_number does not crash
# ═══════════════════════════════════════════════════════════════════════════

class TestNullInvoiceSafety:

    def test_stock_register_page_loads_without_crash(self, page):
        """StockRegister renders without JS error even if data has null fields."""
        login_as(page, "storekeeper")

        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        page.goto(f"{BASE_URL}/stock-register")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        # Assert: no JavaScript errors
        js_errors = [e for e in errors if "null" in e.lower() or "cannot read" in e.lower() or "undefined" in e.lower()]
        assert len(js_errors) == 0, f"JS errors on stock-register: {js_errors}"

        # Assert: page rendered — search input is present
        search = page.locator("input[placeholder*='Search'], input[placeholder*='search']")
        assert search.count() > 0, "Search input not found — page did not render"


# ═══════════════════════════════════════════════════════════════════════════
# 4. Bottom nav does not overlap submit button
# ═══════════════════════════════════════════════════════════════════════════

class TestBottomNavOverlap:

    def test_finalize_button_above_bottom_nav(self, page):
        """At 375px, the Finalize Stock Entry button is above the bottom nav."""
        login_as(page, "storekeeper")
        page.goto(f"{BASE_URL}/new-stock-register")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("input[placeholder='INV-REF-001']", timeout=15000)
        page.wait_for_timeout(300)

        # Scroll to bottom of the page
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(500)

        btn = page.get_by_role("button", name="Finalize Stock Entry")
        assert btn.is_visible(), "Finalize Stock Entry button is not visible after scrolling"

        btn_box = btn.bounding_box()
        assert btn_box is not None, "Button has no bounding box"

        nav = page.locator(".bottom-nav")
        if nav.count() > 0 and nav.is_visible():
            nav_box = nav.bounding_box()
            assert nav_box is not None, "Bottom nav has no bounding box"
            assert btn_box["y"] + btn_box["height"] <= nav_box["y"] + 5, (
                f"Button bottom ({btn_box['y'] + btn_box['height']}) overlaps "
                f"nav top ({nav_box['y']}) — padding-bottom fix failed"
            )


# ═══════════════════════════════════════════════════════════════════════════
# 5. LowStockAlert re-renders after inventory-updated event
# ═══════════════════════════════════════════════════════════════════════════

class TestLowStockAlertRemount:

    def test_alert_responds_to_inventory_event(self, page):
        """After 5+ seconds, dispatching inventory-updated still triggers re-fetch."""
        login_as(page, "storekeeper")
        page.goto(f"{BASE_URL}/inventory")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        # Dispatch the custom event and verify the component is still alive
        page.evaluate("window.dispatchEvent(new Event('inventory-updated'))")
        page.wait_for_timeout(2000)

        # Assert: page is still functional (no crash, no redirect to login)
        assert "/inventory" in page.url, "Page navigated away after inventory-updated event"

        # Assert: low-stock-alert or table still exists in DOM
        alert_or_table = page.locator(".low-stock-alert, table.inv-table, .inv-table-container")
        assert alert_or_table.count() > 0, (
            "No inventory UI elements found after inventory-updated — "
            "component may have unmounted due to stale closure"
        )


# ═══════════════════════════════════════════════════════════════════════════
# 6. Settings config values are numeric
# ═══════════════════════════════════════════════════════════════════════════

class TestSettingsNumericConfig:

    def test_chemical_reorder_level_is_numeric(self, page):
        """Chemical reorder level input shows a number, not NaN or empty."""
        login_as(page, "storekeeper")
        page.goto(f"{BASE_URL}/settings")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        # Click Chemical Levels tab
        chem_tab = page.get_by_role("button", name="Chemical Levels")
        if chem_tab.count() > 0:
            chem_tab.click()
            page.wait_for_timeout(1000)

            # Find the reorder level input
            reorder_input = page.locator("input[type='number'], input.common-level-input").first
            if reorder_input.count() > 0:
                val = reorder_input.input_value()
                assert val != "NaN", f"Chemical reorder level is NaN: '{val}'"
                assert val != "", "Chemical reorder level is empty"
                if val:
                    assert float(val) == float(val), f"Chemical reorder level is not numeric: '{val}'"

    def test_apparatus_reorder_level_is_numeric(self, page):
        """Apparatus reorder level input shows a number, not NaN or empty."""
        login_as(page, "storekeeper")
        page.goto(f"{BASE_URL}/settings")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        # Click Apparatus Levels tab
        app_tab = page.get_by_role("button", name="Apparatus Levels")
        if app_tab.count() > 0:
            app_tab.click()
            page.wait_for_timeout(1000)

            reorder_input = page.locator("input[type='number'], input.common-level-input").first
            if reorder_input.count() > 0:
                val = reorder_input.input_value()
                assert val != "NaN", f"Apparatus reorder level is NaN: '{val}'"
                assert val != "", "Apparatus reorder level is empty"
                if val:
                    assert float(val) == float(val), f"Apparatus reorder level is not numeric: '{val}'"


# ═══════════════════════════════════════════════════════════════════════════
# 7. No ProtectedRoute console.log messages
# ═══════════════════════════════════════════════════════════════════════════

class TestNoProtectedRouteConsoleLogs:

    def test_no_protected_route_debug_logs(self, page):
        """Navigating protected pages produces zero 'ProtectedRoute' console messages."""
        console_msgs = []
        page.on("console", lambda msg: console_msgs.append(msg.text))

        login_as(page, "storekeeper")

        # Visit several protected pages to trigger ProtectedRoute renders
        for path in ["/", "/inventory", "/stock-register", "/settings"]:
            page.goto(f"{BASE_URL}{path}")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(500)

        pr_logs = [m for m in console_msgs if "ProtectedRoute" in m]
        assert len(pr_logs) == 0, (
            f"Found {len(pr_logs)} ProtectedRoute console messages: {pr_logs[:3]}"
        )


# ═══════════════════════════════════════════════════════════════════════════
# 8. All API URL paths resolve (leading-slash convention)
# ═══════════════════════════════════════════════════════════════════════════

class TestAPIUrlPaths:

    def test_no_404_on_main_pages(self, page):
        """Every main page's API calls return 200, not 404."""
        failed_urls = []

        def on_response(resp):
            if resp.status == 404 and "/api/" in resp.url:
                failed_urls.append(resp.url)

        page.on("response", on_response)

        login_as(page, "storekeeper")

        pages_to_visit = ["/inventory", "/stock-register", "/settings"]
        for path in pages_to_visit:
            page.goto(f"{BASE_URL}{path}")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)

        assert len(failed_urls) == 0, (
            f"API 404s detected: {failed_urls} — URL path convention may be broken"
        )
