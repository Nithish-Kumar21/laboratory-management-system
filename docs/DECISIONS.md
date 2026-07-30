# Architecture Decisions

## 1. PostgreSQL triggers are authoritative for inventory logic

- `chemical_item_after_insert` trigger handles stock register inventory increment
- `damaged_item_after_insert` trigger handles inventory decrement on damaged entry
- Python-level `perform_create()` inventory logic was removed to prevent double increment/decrement
- Rationale: DB trigger fires regardless of insertion method (API, shell, admin); Python code can be bypassed

## 2. Inventory decrements at Issued stage, not Completed

- When storekeeper marks request as Issued, inventory is decremented by requested_quantity immediately
- At Reported/Completed stage, only delta adjustments apply:
  - inventory += returned_quantity
  - inventory -= additional_used_quantity
- Rationale: physically handed-out chemicals must not show as available to other staff

## 3. returned_quantity and additional_used_quantity are stored explicitly

- Never calculated from other fields
- Asserted directly from DB in tests

## 4. Staff is responsible for reporting actual chemical usage after lab session

- Storekeeper issues whole jar/bottle, staff reports actual consumption
- Staff cannot file a new request until previous session is reported

## 5. e2e_cleanup Django management command is test-only

- Deletes IssueRegister → StockRequestChemicalItem → StockRequest for test users
- Must NEVER be run in production

## 6. select_for_update() + @transaction.atomic required for inventory decrements

- Prevents race conditions when multiple staff request the same chemical concurrently
- Concurrency test verified: inventory decremented exactly once (1000 → 900), second concurrent request returns 400

## 7. Pre-deploy security hardening — settings split, secrets management, login rate limiting (2026-07-27)

**What was implemented:**
- **SECRET_KEY no-fallback**: `base.py` reads `SECRET_KEY` via `os.environ['SECRET_KEY']` (crashes with KeyError if missing — no `.env` fallback). `settings.py` (monolithic) was deleted; split across `base.py`, `dev.py`, `prod.py`.
- **DEBUG=False leak prevention**: `prod.py` sets `DEBUG = False`. LoginView 500 responses return no traceback, no file paths, no SQL — verified by automated test.
- **Login rate limiting**: DRF-native `LoginRateThrottle` (5/min per IP) added to `LoginView.throttle_classes`. Coexists independently with the existing account lockout mechanism (5 failed attempts → 30min lockout).
- **`.env.example`**: Created with variable names only, no real values.
- **Test coverage**: 5 automated tests in `tests/test_security_hardening.py` verifying SECRET_KEY crash, DEBUG=False leak prevention, throttle firing, throttle message clarity, and lockout-throttle independence.

**Rationale for DRF native throttling over django-ratelimit:**
- DRF's `SimpleRateThrottle` is already installed (dependency of djangorestframework) — adds zero new dependencies
- `django-ratelimit` would add a package, middleware configuration, and a different API surface for a single use case
- DRF throttle integrates directly with view classes via `throttle_classes`, no middleware changes needed
- Scope-based rate config (`'login': '5/min'`) in `REST_FRAMEWORK.DEFAULT_THROTTLE_RATES` is clean and readable
