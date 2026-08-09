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

## 8. Raw SQL schema changes must be applied in 3 places

All models are `managed=False` — Django does not auto-apply schema changes.
Every schema change is a manually-run SQL statement (`ALTER TABLE`,
`CREATE TABLE`, etc.). This is intentional (it prevents AI agents/tools from
silently drifting the schema), but it means schema changes do NOT propagate
anywhere automatically.

**The rule:** a raw SQL schema change is only "done" when it has been applied
in all three places:

1. **Your own real/working local database** — the one the app actually runs against day to day.
2. **Your own local test database** — the separate database Django auto-creates for `manage.py test`. This is NOT the same database as #1, even though it's easy to assume it is. If tests suddenly fail with "column does not exist" errors after a schema change, this is the first thing to check.
3. **Every teammate** — each teammate maintains their own separate local database (not shared), so the same SQL must be manually re-run by each person on both their real and test databases.

**Practical tip:** the fastest way to re-sync a test database after a schema
change is to dump the schema (not data) from the real database and restore it
into the test database, keeping the `django_migrations` table/ledger intact so
Django doesn't attempt to re-migrate a `managed=False` project.

**Full background:** see `docs/KNOWN_ISSUES_schema_sync_note.md` (August 2026
incident: a `committed_quantity_ml` column added to one teammate's working DB
caused 14 false test failures on another machine until the test DB was re-synced).
