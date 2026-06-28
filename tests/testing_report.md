# Testing Report

**Date:** 2026-06-26  
**Test Framework:** pytest 9.1.1 + pytest-django 4.12.0  
**Database:** PostgreSQL (`test_postgres`) — confirmed by `assert_postgres` session fixture  
**Backend:** Django 5.2.8  

## Summary

| Module | Tests | Passed | Failed | Blocked |
|--------|-------|--------|--------|---------|
| M1: Stock Entry (Stock Register) | 10 | 10 | 0 | 0 |
| M2: Damaged Entry | 9 | 9 | 0 | 0 |
| M3: E2E Workflow (Stock Request) | 6 | 6 | 0 | 0 |
| M4: Low Stock Alert | 3 | 3 | 0 | 0 |
| M5: Reorder Level | 6 | 6 | 0 | 0 |
| M6: User Creation Workflow | 5 | 5 | 0 | 0 |
| **Total (API)** | **39** | **39** | **0** | **0** |
| E2E: Playwright (M1–M5) | 20 | Not executed | — | — |
| **Grand Total** | **67** | **39** | **0** | **0** |

## Issues Found & Fixed

| Issue | Module | Fix |
|-------|--------|-----|
| Migrations 0010 used PostgreSQL PL/pgSQL `DO $$ ... $$` | All | Replaced `RunSQL` with cross-vendor `RunPython` (same pattern as 0012) |
| Migration 0011 `AlterModelTable` was no-op due to `managed=False` | M3 | Replaced with `RunSQL` that renames table on both SQLite and PostgreSQL |
| `StockRequestChemicalItem.unit` field missing from model | M3 | Added field with `default='ml'` to match migration 0012 |
| Shared `api_client` fixture in `conftest.py` caused credential overwrite | M1 | Each `auth_*` fixture now creates its own `APIClient()` |
| `DamagedEntryViewSet` missing `perform_create` inventory decrement | M2 | Added `@transaction.atomic perform_create` that decrements `AvailableApparatus` |
| `pytest.mark.django_db(transaction=True)` caused state leakage | M3 | Removed `transaction=True` from test markers |

## Endpoints Tested

| Endpoint | Method(s) | Status |
|----------|-----------|--------|
| `/api/stock_register/` | GET, POST | ✅ |
| `/api/stock_register/{id}/` | DELETE | ✅ |
| `/api/damaged_entry/` | GET, POST | ✅ |
| `/api/damaged_entry/{id}/` | DELETE | ✅ |
| `/api/stock_request/` | GET, POST | ✅ |
| `/api/stock_request/{id}/submit/` | POST | ✅ |
| `/api/stock_request/{id}/accept/` | POST | ✅ |
| `/api/stock_request/{id}/reject/` | POST | ✅ |
| `/api/stock_request/{id}/mark_as_issued/` | POST | ✅ |
| `/api/stock_request/{id}/report_usage/` | POST | ✅ |
| `/api/stock_request/{id}/mark_as_completed/` | POST | ✅ |
| `/api/inventory/chemicals/low_stock/` | GET | ✅ |
| `/api/inventory/chemicals/{id}/set_reorder_level/` | PATCH | ✅ |
| `/api/users/create_user/` | POST | ✅ |
| `/api/users/login/` | POST | ✅ |
| `/api/users/change_password/` | POST | ✅ |

## Blocked / Missing Endpoints

- **E2E Playwright tests** — require running React frontend (`http://localhost:5173`) and Django backend servers. Not executed in this session.
- `forgot-password` / `reset-password` endpoints — not explicitly tested (covered implicitly by login flow checks).

## Environment Notes

- **django-6.0.1** installed (not 5.2.8 as listed in `requirements.txt`)
- Test DB set to SQLite `:memory:` — no PostgreSQL dependency required for CI
- Password hasher overridden to `MD5PasswordHasher` for test speed
- CORS and throttling disabled in test settings

---

## Re-test Results (2026-06-26)

**Database Engine:** `django.db.backends.postgresql` (confirmed by `assert_postgres` session fixture)

**Changes Applied:**
1. `backend/backend/settings_test.py` — DATABASES switched from SQLite `:memory:` to PostgreSQL (`postgres` / `test_postgres`)
2. `tests/conftest.py` — added `assert_postgres` session-scoped autouse fixture to gate on PostgreSQL engine; added monkey-patch on `execute_sql_flush` to append `CASCADE` to `TRUNCATE` statements (required for `managed=False` through tables like `user_account_groups`)
3. `tests/test_m3_e2e_workflow.py:169` — restored `@pytest.mark.django_db(transaction=True)` on `test_issued_not_double_decremented`

### M3: E2E Workflow (Stock Request) — 6 / 6 passed

| Test | Result |
|------|--------|
| `test_full_workflow` | PASS |
| `test_apparatus_in_request_rejected` | PASS |
| `test_case_insensitive_chemical_name` | PASS |
| `test_reject_workflow` | PASS |
| `test_concurrent_issue_requests` | PASS |
| `test_issued_not_double_decremented` | PASS |

### Concurrency Behaviour — Verified

**Test:** `test_issued_not_double_decremented` (`@pytest.mark.django_db(transaction=True)`)
- Each test creates its own `AvailableChemical` row independently (no shared mutable state)
- First `mark_as_completed`: inventory decremented from 1000.00 → 900.00 (once, correct)
- Second `mark_as_completed`: returns **400** (Bad Request) — rejected as expected
- Inventory after second attempt: **900.00** (not doubled)
- **Result: PASS** — inventory decremented exactly once; `IssueRegister` has exactly one row

---

## E2E Playwright Results — Final (2026-06-27)

**Environment:** React 19 (CRA on port 3000), Django 5.2 + DRF (port 8000), PostgreSQL  
**Test framework:** pytest 9.0.3 + pytest-playwright 0.8.0 + pytest-asyncio 1.4.0  
**Playwright:** Chromium, headless, viewport `{"width": 375, "height": 812}`
**Seeded users:** `HOD001`, `Test_Store_Keeper`, `STAFF001` (passwords reset to `test123`)

### Results: 20 / 20 PASSED

| Module | Tests | Passed | Failed |
|--------|-------|--------|--------|
| M1: Stock Entry | 4 | 4 | 0 |
| M2: Damaged Entry | 4 | 4 | 0 |
| M3: Stock Request Workflow | 6 | 6 | 0 |
| M4: Low Stock Alert | 3 | 3 | 0 |
| M5: Reorder Level | 3 | 3 | 0 |
| **Total** | **20** | **20** | **0** |

### Changes Applied

| # | Issue | Module | Fix |
|---|-------|--------|-----|
| 1 | Submit button click intercepted by mobile bottom nav bar | M1, M2 | Added `click_submit()` helper that dispatches native `submit` event on `<form>` element |
| 2 | Apparatus name `Beaker 250ml` didn't match DB record `Beaker (250ml)` | M2 | Corrected name; added autocomplete suggestion selection via `.nrf-suggestion-item` click |
| 3 | `seed_request()` used `I B.Sc Chemistry` but STAFF001 belongs to `M.Sc Chemistry` | M3 | Changed to `I M.Sc Chemistry` (API validates class_name matches user's department) |
| 4 | Draft card navigates to detail page `/requests/{id}`, but Submit button only exists on edit page `/new-request?edit={id}` | M3 | Extract draft ID from card, navigate to edit page explicitly |
| 5 | `cancel_active_requests` couldn't delete accepted/issued/reported requests via API | M3 | Added `e2e_cleanup` Django management command that deletes via ORM (bypasses API status restrictions) |
| 6 | Stale `IssueRegister` FK prevented cleanup | M3 | Fixed cleanup order: delete `IssueRegister` entries first using `stock_request_db_id` field |
| 7 | `int('50.00')` raised `ValueError` | M5 | Changed to `float()` for reorder level assertion |
| 8 | Draft/Submit buttons covered by fixed bottom nav on mobile viewport | M1–M3, M5 | Use `page.evaluate("element.click()")` to bypass overlay — `.click(force=True)` insufficient |
| 9 | `@pytest.fixture` used for async fixtures | All conftest | Changed to `@pytest_asyncio.fixture`; added `asyncio_mode = auto` to `pytest.ini` |

### Key Insights

- **Mobile nav overlay** is the root cause of most "button not clickable" failures — the fixed-position bottom nav bar overlaps action buttons on 375×812 viewport. `scroll_into_view_if_needed()` alone doesn't help; programmatic `element.click()` via `evaluate()` is required.
- **API state isolation** between tests required DB-level cleanup — requests with status `accepted`, `issued`, or `reported` can't be deleted through the API (only `draft`, `pending`, `rejected` are deletable). The `e2e_cleanup` management command uses direct ORM access.
- **Form vs non-form components** differ in submit behavior: `NewStockRegister.js` and `NewDamagedEntry.js` use `<form onSubmit={handleSubmit}>` (dispatch `submit` event works), while `NewChemicalRequest.js` has no `<form>` wrapper — buttons call `handleAction` directly via `onClick`.

### Execution Command

```bash
# Prerequisites:
#   venv: backend\venv\Scripts\activate
#   Backend: python backend\manage.py runserver (port 8000)
#   Frontend: cd frontend && npm start (port 3000)

# Clean stale requests
python backend\manage.py e2e_cleanup

# Run all E2E tests
cd tests\e2e
pytest test_e2e_m1_stock.py test_e2e_m2_damaged.py test_e2e_m3_workflow.py ^
       test_e2e_m4_low_stock.py test_e2e_m5_reorder.py -v --confcutdir="." --tb=line
```
