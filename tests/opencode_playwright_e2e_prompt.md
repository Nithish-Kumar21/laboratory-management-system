# OpenCode Session Prompt — Playwright Frontend E2E Tests (M1–M5)

---

## CONTEXT

This is Phase 2 of LMS automated testing.
Phase 1 (backend pytest API tests) is complete and passing on PostgreSQL.
This session adds Playwright E2E browser coverage for M1–M5 frontend flows.

**Stack:** React 19 (Vite), Django 5.2 + DRF, PostgreSQL, JWT auth
**Frontend:** `http://localhost:5173/`
**Backend:** `http://localhost:8000/api/`
**Viewport:** `{"width": 375, "height": 812}` — mobile-first PWA, apply to ALL pages
**Browser:** Chromium only
**Playwright language:** Python (async)

---

## SHARED SETUP

### File Structure

```
tests/
  e2e/
    conftest_e2e.py          ← shared login helpers + DB seed via API
    test_e2e_m1_stock.py
    test_e2e_m2_damaged.py
    test_e2e_m3_workflow.py
    test_e2e_m4_low_stock.py
    test_e2e_m5_reorder.py
```

### conftest_e2e.py

```python
import pytest
import requests
from playwright.async_api import async_playwright

BASE_API = "http://localhost:8000/api"
BASE_URL  = "http://localhost:5173"

CREDENTIALS = {
    "staff":       {"username": "staff_user",       "password": "testpass123"},
    "hod":         {"username": "hod_user",         "password": "testpass123"},
    "storekeeper": {"username": "storekeeper_user", "password": "testpass123"},
}

def get_token(role: str) -> str:
    r = requests.post(f"{BASE_API}/users/login/", json=CREDENTIALS[role])
    assert r.status_code == 200, f"Login failed for {role}: {r.text}"
    return r.json()["access"]

def auth_headers(role: str) -> dict:
    return {"Authorization": f"Bearer {get_token(role)}"}

@pytest.fixture
async def browser_context():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 375, "height": 812})
        yield context
        await browser.close()

async def login_as(page, role: str):
    """Navigate to login page and authenticate as given role."""
    await page.goto(f"{BASE_URL}/login")
    await page.get_by_role("textbox", name="username").fill(CREDENTIALS[role]["username"])
    await page.get_by_role("textbox", name="password").fill(CREDENTIALS[role]["password"])
    await page.get_by_role("button", name="Login").click()
    await page.wait_for_url(f"{BASE_URL}/dashboard", timeout=5000)
```

### Selector Priority (strictly follow this order)
1. `get_by_role()` with accessible name
2. `get_by_label()`
3. `get_by_text()`
4. `data-testid` attribute
5. CSS selector — **last resort only**

### Missing `data-testid` Policy
If a required element has no accessible role or `data-testid`, do NOT use a fragile CSS selector.
Instead: add a comment `# FRONTEND GAP: needs data-testid="<suggested-name>"` and mark the test `pytest.mark.xfail(reason="missing data-testid")`.

---

## MODULES

---

### M1 — Stock Register Entry → Inventory Update (Storekeeper UI)

**File:** `test_e2e_m1_stock.py`

**Seed (Arrange via API before each test):**
```python
# POST /api/stock_register/ with storekeeper token to set known inventory state
```

**Tests:**

#### test_stock_entry_form_visible
- Login as storekeeper
- Navigate to Stock Register page
- Assert form fields visible: Chemical Name, Quantity, Unit, Supplier, Date
- Assert submit button visible

#### test_stock_entry_creates_record
- Login as storekeeper
- Fill and submit stock entry form (Chemical: "Sulphuric Acid", Qty: 500, Unit: ml)
- Assert success toast/message appears
- Assert new row visible in stock register table with correct values

#### test_stock_entry_updates_inventory
- Seed: record existing inventory quantity via `GET /api/inventory/chemicals/` before form submit
- Submit stock entry for existing chemical via UI
- After success: fetch inventory via API
- Assert inventory quantity increased by submitted amount

#### test_stock_entry_validation
- Submit form with empty Chemical Name field
- Assert inline validation error appears (do not proceed to API call)

---

### M2 — Damaged Entry → Inventory Update (Storekeeper UI)

**File:** `test_e2e_m2_damaged.py`

**Tests:**

#### test_damaged_entry_form_visible
- Login as storekeeper
- Navigate to Damaged Entry page
- Assert fields visible: Chemical Name, Quantity, Reason, Date

#### test_damaged_entry_creates_record
- Fill and submit damaged entry form (Chemical: "Hydrochloric Acid", Qty: 50, Reason: "Spillage")
- Assert success feedback
- Assert new row appears in damaged entry list

#### test_damaged_entry_decrements_inventory
- Seed: record inventory quantity via API before submit
- Submit damaged entry via UI
- After success: fetch inventory via API
- Assert inventory quantity decreased by submitted amount

#### test_damaged_entry_cannot_exceed_available_stock
- Seed: set inventory for a chemical to 10 units via API
- Submit damaged entry for 999 units of same chemical via UI
- Assert error message shown, inventory unchanged

---

### M3 — Chemical Request E2E Workflow (Staff → HOD → Storekeeper UI)

**File:** `test_e2e_m3_workflow.py`

**Tests:**

#### test_staff_creates_and_submits_request
- Login as staff
- Navigate to New Request page
- Fill: Lab session details, add chemical row (Name: "Acetone", Qty: 100, Unit: ml)
- Save as draft → assert status shows "Draft"
- Submit → assert status changes to "Pending"

#### test_hod_approves_request
- Seed: create + submit a request via API (staff token)
- Login as HOD
- Navigate to Pending Requests
- Assert the request appears in list
- Click Approve → assert status changes to "Accepted"
- Assert rejection reason field is NOT shown after approval

#### test_hod_rejects_request
- Seed: create + submit a request via API
- Login as HOD
- Click Reject → fill rejection reason → confirm
- Assert status changes to "Rejected"
- Assert rejection reason text is visible in request detail

#### test_storekeeper_issues_chemicals
- Seed: create → submit → accept request via API
- Login as storekeeper
- Navigate to Accepted Requests
- Click Issue → assert issue form shows correct chemicals and quantities
- Confirm issue → assert status changes to "Issued"
- Assert inventory decremented (verify via API after UI action)

#### test_apparatus_blocked_in_request
- Login as staff
- Attempt to add apparatus item to chemical request
- Assert UI blocks submission or shows error — apparatus not permitted in stock requests

#### test_staff_reports_return
- Seed: push request to "Issued" state via API
- Login as staff
- Navigate to issued request
- Click Report Usage → fill returned quantities
- Submit → assert status changes to "Reported"

---

### M4 — Low Stock Alert (Storekeeper/HOD UI)

**File:** `test_e2e_m4_low_stock.py`

**Tests:**

#### test_low_stock_alert_visible_after_issue
- Seed: set inventory for "Ethanol" to 5 units, reorder_level to 20 via API
- Login as storekeeper
- Navigate to Inventory / Dashboard
- Assert low stock alert or badge is visible for "Ethanol"

#### test_no_alert_when_stock_sufficient
- Seed: set inventory for "Methanol" to 100 units, reorder_level to 20 via API
- Login as storekeeper
- Assert NO low stock alert shown for "Methanol"

#### test_low_stock_list_page
- Login as HOD or storekeeper
- Navigate to Low Stock Alerts page (if separate route exists)
- Assert page loads without error
- Assert chemicals below reorder level are listed

---

### M5 — Reorder Level (Storekeeper UI)

**File:** `test_e2e_m5_reorder.py`

**Tests:**

#### test_set_reorder_level_via_ui
- Login as storekeeper
- Navigate to Inventory page
- Find chemical row → click Set Reorder Level
- Enter value: 50 → save
- Assert success feedback
- Verify via `GET /api/inventory/chemicals/{id}/` that `reorder_level == 50`

#### test_reorder_level_boundary_at_limit
- Seed: set inventory qty = 50, reorder_level = 50 via API
- Login as storekeeper
- Assert NO alert shown (quantity == reorder_level, not below)

#### test_reorder_level_boundary_below_limit
- Seed: set inventory qty = 49, reorder_level = 50 via API
- Login as storekeeper
- Assert alert IS shown (quantity < reorder_level)

---

## CONVENTIONS

- Every test: `# Arrange / # Act / # Assert` comments
- DB state always seeded via API calls in Arrange block — never rely on leftover state
- After every UI action that should update DB: verify via a direct `GET` API call, not just UI text
- `await page.wait_for_selector(...)` or `await expect(locator).to_be_visible()` — no bare `time.sleep()`
- On test failure: auto-capture screenshot to `tests/e2e/screenshots/<test_name>.png`

```python
# Add to conftest_e2e.py
@pytest.fixture(autouse=True)
async def screenshot_on_failure(page, request):
    yield
    if request.node.rep_call.failed:
        await page.screenshot(path=f"tests/e2e/screenshots/{request.node.name}.png")
```

---

## EXECUTION

```bash
playwright install chromium
pytest tests/e2e/ -v --headed=false 2>&1 | tee e2e_output.txt
```

---

## DELIVERABLE

Append an **"E2E Playwright Results (M1–M5)"** section to the existing `testing_report.md`:

```markdown
## E2E Playwright Results (M1–M5)

| Module | Test | Result | Notes |
|--------|------|--------|-------|
| M1 | test_stock_entry_form_visible | PASS/FAIL/XFAIL | |
| M1 | test_stock_entry_creates_record | PASS/FAIL/XFAIL | |
| ... | ... | ... | |

### Frontend Gaps Found
| # | Test | Missing Element | Suggested data-testid |
|---|------|-----------------|-----------------------|
| 1 | test_hod_approves_request | Approve button | `data-testid="approve-btn"` |

### Screenshots (failures only)
- `tests/e2e/screenshots/<test_name>.png`
```
