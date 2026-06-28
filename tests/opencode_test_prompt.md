# OpenCode Session Prompt — LMS Automated Testing (pytest + Playwright)

---

## PROJECT CONTEXT

**Stack:** Django 5.2 + DRF, React 19, PostgreSQL, JWT auth (djangorestframework-simplejwt)
**Roles:** Staff, HOD, Storekeeper (+ Admin)
**7-state workflow:** `draft → pending → accepted → rejected → issued → reported → completed` (+ `cancelled`)
**Base URL (API):** `http://localhost:8000/api/`
**Base URL (Frontend):** `http://localhost:5173/`
**Playwright viewport:** 375px width (mobile-first PWA)

---

## MODULES TO TEST

### M1 — Stock Register Entry → Inventory Update
Verify that when a storekeeper creates a new stock entry via `POST /api/stock/`, the inventory quantity for that chemical is incremented correctly in the database. Test both new chemical stock and top-up of existing stock.

### M2 — Damaged Entry → Inventory Update
Verify that when a damaged/loss entry is recorded (`POST /api/damaged/` or equivalent), the inventory quantity is decremented correctly. Confirm the damaged log record is persisted with correct fields (chemical name, quantity, reason, date).

### M3 — Chemical Request E2E Workflow (Staff → HOD → Storekeeper)
Full workflow test:
1. Staff creates a request (`POST /api/requests/` → status: `draft`)
2. Staff submits the request (`PATCH` → status: `pending`)
3. HOD approves (`PATCH` → status: `accepted`)
4. Storekeeper issues chemicals (`POST /api/issue/` → status: `issued`)
5. Verify `IssueRegister` row is created with correct chemicals and quantities
6. Verify inventory is decremented by issued quantity
7. Staff reports return (`PATCH` → status: `reported`)
8. HOD/Storekeeper completes (`PATCH` → status: `completed`)

**Constraint:** Use `select_for_update()` path — test that concurrent issue requests do not double-decrement inventory (run two simultaneous issue calls, assert inventory decremented exactly once per quantity).

### M4 — Low Stock Alert
After issuing chemicals, verify that if inventory falls below `reorder_level`, a low stock alert is triggered (check DB flag / notification record / API response field — use whichever the implementation uses). Also test that the alert does NOT fire when inventory remains above `reorder_level`.

### M5 — Reorder Level Enforcement
Verify that `reorder_level` is stored correctly on stock entry. Verify the comparison logic: `inventory_quantity < reorder_level` → alert state. Test boundary values: `quantity == reorder_level` (no alert), `quantity == reorder_level - 1` (alert).

### M6 — HOD User Creation → Login → Workflow
1. HOD creates a new Staff user via `POST /api/users/` (role=Staff, degree=B.Sc Chemistry)
2. Verify account exists in DB
3. New user logs in (`POST /api/auth/token/`) — expect first-login forced password change response
4. User sets new password
5. User logs in again with new password — expect `200` + JWT tokens
6. User accesses `/api/requests/` — expect `200` (not `401`/`403`)
7. Playwright E2E: Navigate to login page → enter credentials → assert dashboard loads → assert role-appropriate nav items visible

---

## INSTRUCTIONS

### Setup
- Confirm Django dev server is running on port `8000` and React dev server on port `5173` (or adjust base URLs if different)
- Use `pytest-django` for all API/integration tests
- Use Playwright (Python, async) for E2E tests in Module 6
- Set Playwright viewport to `{"width": 375, "height": 812}` for all pages
- Create a `conftest.py` with:
  - `@pytest.fixture` for DB setup (use `django_db` or `transactional_db` as appropriate)
  - JWT token fixtures for each role: `staff_token`, `hod_token`, `storekeeper_token`
  - A helper `auth_headers(token)` returning the `Authorization: Bearer` header dict
  - An `api_client` fixture using `requests` or DRF's `APIClient`

### Test File Structure

```
tests/
  conftest.py
  test_m1_stock_entry.py
  test_m2_damaged_entry.py
  test_m3_e2e_workflow.py
  test_m4_low_stock_alert.py
  test_m5_reorder_level.py
  test_m6_user_creation_workflow.py
  e2e/
    test_m6_playwright.py
```

### Conventions
- AAA pattern strictly: `# Arrange / # Act / # Assert` comments in every test
- Each test must be independent — no shared mutable state between tests
- Use `@pytest.mark.django_db(transaction=True)` for concurrency test in M3
- For inventory decrement assertions: always query DB directly via Django ORM, not just API response
- Parametrize boundary value tests in M5 using `@pytest.mark.parametrize`
- All chemical names in test data: use `UPPER_SNAKE_CASE` constants at top of each file (e.g. `CHEMICAL_NAME = "Hydrochloric Acid"`) — matching is case-insensitive in the system

### Execution Order

```bash
pytest tests/test_m1_stock_entry.py -v
pytest tests/test_m2_damaged_entry.py -v
pytest tests/test_m3_e2e_workflow.py -v
pytest tests/test_m4_low_stock_alert.py -v
pytest tests/test_m5_reorder_level.py -v
pytest tests/test_m6_user_creation_workflow.py -v
playwright install chromium
pytest tests/e2e/test_m6_playwright.py -v
```

Capture all output. Note every `PASSED` / `FAILED` / `ERROR`.

---

## IMPORTANT GUARDS

- Do **NOT** skip the concurrency test in M3 — it is critical for this system
- If an endpoint does not exist yet (`404`/`405`), mark the test as `BLOCKED` and note it in the report — do not delete the test
- If first-login enforcement is not implemented, flag it as a **SECURITY GAP** in the report
- `returned_quantity` is stored explicitly — do not calculate it; assert the stored DB value directly
- Apparatus items must never appear in stock requests — add one negative test in M3 asserting `400` if apparatus is included
- Case-insensitive chemical name matching: test with `"hydrochloric acid"` (lowercase) and assert it matches existing `"Hydrochloric Acid"` inventory row

---

## FINAL DELIVERABLE — `testing_report.md`

After all tests are run, create `testing_report.md` in the project root with this exact structure:

```markdown
# LMS Automated Testing Report

**Date:** <date>
**Tester:** OpenCode Agent
**Environment:** Django 5.2 + React 19 + PostgreSQL

---

## Summary Table

| Module | Description | Total Tests | Passed | Failed | Errors | Status |
|--------|-------------|-------------|--------|--------|--------|--------|
| M1 | Stock Entry → Inventory | | | | | ✅/❌ |
| M2 | Damaged Entry → Inventory | | | | | ✅/❌ |
| M3 | E2E Chemical Workflow | | | | | ✅/❌ |
| M4 | Low Stock Alert | | | | | ✅/❌ |
| M5 | Reorder Level | | | | | ✅/❌ |
| M6 | HOD User Creation + Login | | | | | ✅/❌ |
| **Total** | | | | | | |

---

## Module Results

### M1 — Stock Register Entry → Inventory Update
**Result:** PASS / FAIL  
**Tests run:** N  
**Failures:**
- `<test name>`: `<failure reason>` (if any)

**Notes:** `<any DB state observations>`

---

### M2 — Damaged Entry → Inventory Update
**Result:** PASS / FAIL  
**Tests run:** N  
**Failures:**
- `<test name>`: `<failure reason>` (if any)

**Notes:** `<any DB state observations>`

---

### M3 — Chemical Request E2E Workflow
**Result:** PASS / FAIL  
**Tests run:** N  
**Failures:**
- `<test name>`: `<failure reason>` (if any)

**Notes:** `<concurrency test outcome, IssueRegister observations>`

---

### M4 — Low Stock Alert
**Result:** PASS / FAIL  
**Tests run:** N  
**Failures:**
- `<test name>`: `<failure reason>` (if any)

**Notes:** `<alert trigger mechanism observed>`

---

### M5 — Reorder Level Enforcement
**Result:** PASS / FAIL  
**Tests run:** N  
**Failures:**
- `<test name>`: `<failure reason>` (if any)

**Notes:** `<boundary value behaviour>`

---

### M6 — HOD User Creation + Login + Workflow
**Result:** PASS / FAIL  
**Tests run:** N  
**Failures:**
- `<test name>`: `<failure reason>` (if any)

**Notes:** `<first-login enforcement status, Playwright selector issues if any>`

---

## Failures & Bugs Found

| # | Module | Test | Expected | Actual | Severity |
|---|--------|------|----------|--------|----------|
| 1 | M3 | test_concurrent_issue | inventory -= 10 | inventory -= 20 | HIGH |

---

## Blocked Tests

| # | Module | Test | Reason |
|---|--------|------|--------|
| 1 | M4 | test_low_stock_notification | Endpoint not found (404) |

---

## Security Gaps Identified

| # | Description | Severity |
|---|-------------|----------|
| 1 | First-login password change not enforced | HIGH |

---

## Observations & Recommendations

- `<Any race condition evidence found>`
- `<Any missing DB constraints noticed>`
- `<Any endpoint returning wrong status codes>`
- `<Playwright selector issues if any>`
- `<Any case-sensitivity bugs in chemical name matching>`

---

## Raw pytest Output

\`\`\`
<paste full terminal output here>
\`\`\`
```
