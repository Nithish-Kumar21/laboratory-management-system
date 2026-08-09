# Git Branch Deep Investigation Report

**Date:** 2026-07-31  
**Author:** OpenCode (read-only investigation)  
**Branches examined:** `feature/year-end-report`, `fix/race-conditions-pre-deploy`, `ui-enhancement2`, `security-strengthening`, `main`

---

## 1. feature/year-end-report

### What is the year-end report feature?

Commit `d4f4f6a` (Nithish, Jun 29) created a brand-new **Year-End Audit Report** module for the Chemistry Department. It builds:

- **A new Django app** (`backend/reports/`) with:
  - A `YearEndReportView` — collects spending, chemical usage, damage logs, current stock levels, and restock recommendations by academic year
  - A `YearEndPDFDownloadView` — generates a formatted PDF (5 pages: cover, purchases, usage, damage, restock) using `reportlab`
  - A `YearEndExcelDownloadView` — generates an Excel workbook (6 sheets: Summary, Purchases, Usage, Damage Log, Current Stock, Restock Recommendations) using `openpyxl`
  - A custom permission `IsHODOrStorekeeper` so only those roles can see reports
- **A frontend dashboard** (`frontend/src/pages/reports/`) with:
  - 7 React components: StatCards, MonthlyTrendChart (line), TopChemicalsChart (bar), SpendDonutChart (pie), UsageByClassChart (bar), DamageSummaryChart (bar), RestockTable
  - Uses **Recharts** for charting
  - Year selector (last 5 academic years) with PDF/Excel download buttons
  - Mobile-responsive layout with a sticky download bar
- **Nav links** in Sidebar and BottomNav for HOD/Storekeeper roles

**In plain English:** This lets the HOD or Storekeeper open a dashboard, pick an academic year, and see charts/tables of everything the department bought, used, broke, and needs to restock. They can download the same data as a formatted PDF or Excel file. Staff cannot see it.

### Does this feature already exist on other branches?

**Yes, the year-end report files already exist on all three other branches: `main`, `security-strengthening`, and `ui-enhancement2`.** The full file list (`backend/reports/` + `frontend/src/pages/reports/`) is identical on all of them. This means the feature was merged into `main` (via merge commits `c0bab92` and `8778bff`), and then `main` was merged into `security-strengthening` and `ui-enhancement2`. The feature is **not exclusive to `feature/year-end-report`** — the branch contains the original commit but the feature is already deployed everywhere.

### What else is on this branch that is NOT yet on main?

There are **38 commits** on `feature/year-end-report` that are not in `main`. Here they are with plain-English summaries:

| # | Commit | Scope (files touched) | Plain-English summary |
|---|--------|----------------------|----------------------|
| 1 | `a4f1d5d` | 8 files (backups, debug scripts) | Merge conflict resolution — added backup files and debug scripts, no feature code |
| 2 | `f621637` | 4 frontend files | Bug fix: error messages in service/damaged forms were nested incorrectly (fixed recursion); added error state display to StockRequest page |
| 3 | `8889eb6` | 4 backend files (settings, migrations, tests) | Post-merge cleanup: added postgres config + service_entry config to settings, added a DB migration for stock_request columns, fixed tests for new required fields |
| 4 | `67a2fcf` | Merge commit | Merged `origin/feature/chemical-request-v2` into this branch — brings in Dharani's chemical request work |
| 5 | `7c9fb69` | 19 files (new Django app + E2E tests) | **New Service Entry module**: full CRUD backend (models, views, serializers, urls), frontend detail page with action popups, and Playwright E2E tests. Also replaced an old design doc with session documentation. |
| 6 | `3b5a762` | 19 files (backend + frontend) | **Dharani**: Added Day Order, Hour fields to damaged entry; created report views for issue register and stock register; added debug/test scripts |
| 7 | `0e81f89` | 2 frontend files | **Dharani**: Replaced confirmation popups with success toast notifications for Complete/Filing actions — less clicking |
| 8 | `2563f4c` | 3 files (1 frontend, 2 backend) | Bug fix: Floating Action Button positioning on mobile; Card 1 was missing on NewServiceEntry page; null `actioned_at` was causing constraint error |
| 9 | `a2f11db` | 1 frontend file | **Dharani**: Removed "(AUTONOMOUS), Chennai" from college description text |
| 10 | `d538e5d` | 1 frontend file | **Dharani**: Updated login page text and made the form narrower |
| 11 | `a1ab5c4` | 1 backend file | **Dharani**: Hides completed requests from everyone's main feed (they stay accessible via direct URL and issue register) |
| 12 | `49542d8` | 1 backend file | **Dharani**: Fixed a serializer field name that was pointing to the wrong source |
| 13 | `13d2a46` | 24 files | Added "No. of Packs" display to detail views; large E2E test suite for stock requests; new documentation files |
| 14 | `943bd2c` | 2 frontend files | Added Rate per Pack and Total Quantity display to detail view cards; redesigned the look of each line item |
| 15 | `7cb2774` | 6 files (frontend + backend) | Phone numbers must be exactly 10 digits (frontend and backend validation); restructured detail view layout into 2-row blocks |
| 16 | `68af6fa` | 15 files | **Dharani**: Added Day Order, Hour, Purpose Type cards to StockRequest and IssueRegister detail views; added DB migration for new fields; new test file |
| 17 | `17e8904` | N/A | Bug fix: fixed trigger column mismatch that caused 500 errors; reduced excessive polling |
| 18 | `9d93e76` | N/A | Layout fix: moved form labels inline so each sits directly above its own field |
| 19 | `6c3f077` | N/A | Cosmetic: replaced header labels with placeholder text in Chemicals & Apparatus form rows |
| 20 | `e76d67a` | N/A | Bug fix: corrected Total Price calculation; restructured row layout to prevent overflow |
| 21 | `611584a` | 10 files | **Stock Register v2**: added supplier contact fields (phone, email), renamed `quantity` to `pack_size`, added `no_of_packs`, `total_quantity`, `total_price`; split serializers into read/write; frontend form restructured with live totals and autofill from reorder level |
| 22 | `d77676c` | 32 files | **Phase 1 Hardening**: audit log app, idempotency keys, split settings into base/dev/prod, degree-class filtering, first-login enforcement middleware |
| 23 | `106c5ba` | 19 files | **Password management system**: first-login flow with temp token, forgot/reset password via Gmail SMTP, welcome emails on HOD account creation, password complexity validator, 28 tests |
| 24 | `89d3532` | Merge commit | Merged `main` into the branch |
| 25 | `c88df3e` | 3 doc files | Updated documentation files (DECISIONS, KNOWN_ISSUES, SESSION_PROMPT) |
| 26 | `9339754` | N/A | Bug fix: resolved double inventory increment/decrement; added Playwright E2E tests; enforced PostgreSQL |
| 27 | `8cf7096` | N/A | Switched to PostgreSQL, fixed migration conflicts, removed stale tests.py |
| 28 | `95ae7c8` | N/A | **Dharani**: UI enhancements across modals, unit labels, settings redesign, mobile responsiveness |
| 29 | `f14df27` | N/A | Added unit (ml/g) field to stock register forms; fixed remarks field |
| 30 | `5b9407a` | N/A | Bug fix: pass unit field when marking IssueChemicals as completed |
| 31 | `519039b` | N/A | Bug fix: removed incorrect `db_column` overrides; added unit field to match actual database columns |
| 32 | `16a07e0` | N/A | **Dharani**: Aligned models with PostgreSQL schema; fixed staff/stockkeeper filters; fixed report_usage flow and UI card layout |
| 33 | `6020928` | N/A | Renamed chemical quantity fields; added unit column for ml/g support |
| 34 | `2bef6ba` | N/A | **Dharani**: Low stock is now computed dynamically (not stored); added inventory filter; fixed damaged entry UI |
| 35 | `f891973` | N/A | **Dharani**: Staff-login desktop UI design |
| 36 | `ee6e63c` | N/A | **Dharani**: Major UI refinement across pages, components, and styles |
| 37 | `edd705a` | N/A | **Dharani**: Refined Stock Register and Request modals; added M.Sc classes; filtered admin from User Management |
| 38 | `0a128fb` | N/A | **Dharani**: Transformed User Management into dashboard layout matching an uploaded design image |

**Note:** Commits marked "N/A" for scope were not individually inspected via `git show --stat` because the commit messages sufficiently describe them, and many are small CSS-only or single-file changes.

### Are any of these commits experimental / WIP / abandoned?

**Likely unfinished or low-quality items:**
- `a4f1d5d` (merge conflict resolution) added backup `.bak` files and debug scripts — those look like artifacts, not intended to stay
- Several commits (e.g., `3b5a762`) add debug/test scripts (`debug_error.py`, `test_report_step1.py`, `test_step2.py`) that are debug artifacts, not production code
- The 50+ CSS-only commits at the bottom of the log (modal layout tweaks) are very granular — many are incremental back-and-forth that could be squashed

**Finished and usable:** The Service Entry module (`7c9fb69`), Stock Register v2 (`611584a`), Password management (`106c5ba`), Phase 1 Hardening (`d77676c`), all Dharani's UI work, phone validation, and the report feature itself are all complete, tested features.

### Last updated
**2026-07-10** (3 weeks ago) — commit `a4f1d5d`. No commits in the last 3 weeks.

---

## 2. fix/race-conditions-pre-deploy (extra 5 commits)

This branch has 8 commits total. 3 are the race-condition fixes already reported (`6161cad`, `4d96369`, `f7c109c`). Here are the other 5:

### Commit `da9aa74` — "feat: add company/vendor fields to service entry, venue field to stock requests, and unit selector for chemical items"

| Aspect | Detail |
|--------|--------|
| **Author** | Nithish, Jul 20 |
| **Files changed** | 46 files (backend models, serializers, views; frontend forms; new test suites; architecture docs; locust load-test files; database schema dump) |
| **What it does** | Adds company name/contact fields to service entries; adds a "venue" (room/lab) field to stock requests; adds unit selector dropdown for chemical items; includes a full PostgreSQL schema dump (`database/schema.sql`), architecture planning docs (`architecture/`), and locust load-testing infrastructure |
| **Conflict risk** | **HIGH** — touches `backend/stock_request/` (models, serializers, views), `frontend/src/pages/NewChemicalRequest.js`, `frontend/src/pages/StockRequestDetail.js`, and adds new files that other branches don't have. The schema dump and architecture docs are new files that won't conflict but add bulk. |
| **Is it safe?** | The feature code itself (company fields, venue, unit selector) is self-contained. The added docs and schema dumps are large but non-conflicting. Merge risk is moderate to high mainly due to overlapping stock_request files. |

### Commit `b5a79ed` — "fix(reports): year-end report crashing for all years"

| Aspect | Detail |
|--------|--------|
| **Author** | Nithish, Jul 18 |
| **Files changed** | 1 file: `backend/reports/views.py` (10 lines changed, 5 added, 5 removed) |
| **What it does** | Fixes two bugs in the year-end report that caused crashes: (1) a field name typo — code referenced `quantity` but the actual DB column is `total_quantity`; (2) a type mismatch — comparing a `Decimal` (reorder_level) with a `float` (current_qty) caused a crash. Both fixes are 1-line changes each. |
| **Conflict risk** | **LOW** — touches only one file (`reports/views.py`). But `reports/views.py` on `security-strengthening` may differ from what's in `main`. If both branches changed the same lines, there could be a small conflict. |
| **Is it safe?** | Yes — it's a tiny, targeted bug fix. |

### Commit `a5571cc` — "fix(damaged-entry): rebuild Damaged Items List layout"

| Aspect | Detail |
|--------|--------|
| **Author** | Nithish, Jul 17 |
| **Files changed** | 4 frontend files: `IssueRegister.js`, `IssueRegisterDetail.js`, `NewDamagedEntry.js`, `NewStockRegister.css` |
| **What it does** | Fixes broken CSS grid classes in the Damaged Items List form. Replaced undefined class names with proper grid layouts. Makes the apparatus name full-width on row 1 with delete button, Qty Broken + Caused By side-by-side on row 2. Also added venue field to Issue Register views. |
| **Conflict risk** | **MODERATE** — touches `NewDamagedEntry.js` and `NewStockRegister.css` which are also heavily modified on `security-strengthening` and the feature branch. |
| **Is it safe?** | Mostly safe — layout-only changes, but the overlapping files may cause merge issues. |

### Commit `d9c9aa8` — "fix(common-reorder-level): persist mode toggle to backend"

| Aspect | Detail |
|--------|--------|
| **Author** | Nithish, Jul 17 |
| **Files changed** | 3 files: `inventory/views.py`, `stock_register/serializers.py`, `Settings.js` (frontend) |
| **What it does** | The "common reorder level" toggle in Settings was only changing the UI state — it wasn't sending the change to the backend. This fix persists the toggle value via the API, and re-fetches the settings instance after saving so the UI shows the correct state. |
| **Conflict risk** | **MODERATE** — touches `Settings.js` which is heavily modified on other branches. |
| **Is it safe?** | Safe — small, targeted fix. |

### Commit `24241c4` — "fix(frontend): harden reliability"

| Aspect | Detail |
|--------|--------|
| **Author** | Nithish, Jul 16 |
| **Files changed** | 24 frontend files |
| **What it does** | **Major reliability hardening across the entire frontend:**
- **Token refresh race condition**: When the access token expired and multiple API calls fired simultaneously, they'd all try to refresh the token at once, causing 401 errors. Fixed with "single-flight" pattern so only one refresh happens at a time.
- **NaN guards**: Before submitting any form, numeric fields are validated so "Not a Number" values can't be sent to the server
- **Null safety**: All `.toLowerCase()` calls on backend data are now null-safe
- **Mobile nav**: Fixed bottom nav padding + FAB z-index for small (375px) screens
- **Stale closure**: Fixed `LowStockAlert` using `useCallback` to prevent stale data
- **Settings**: Added type coercion for API config values
- **Cleanup**: Removed debug `console.log` from ProtectedRoute; standardized all API URL paths to leading-slash format |
| **Conflict risk** | **HIGH** — touches 24 files across the entire frontend. Almost every file that other branches also modified (LowStockAlert, Settings, modals, pages, api.js, AuthContext, App.css) is touched here. |
| **Is it safe?** | The fixes themselves are important (especially the token refresh fix and NaN guards). But because it touches so many files, merging will likely require careful conflict resolution on almost every frontend file. |

### Last updated
**2026-07-20** (10 days ago) — commit `da9aa74`

---

## 3. ui-enhancement2

### Full commit log

This branch contains 97 commits going back to the initial project setup. Most are by Nithish or Dharani, with 2 by Sarathy and 5 by Nithish's GitHub noreply address.

### Dharani's contributions (17 commits, Jan 30 – Jul 24)

| Date | Commit | Summary | Scope |
|------|--------|---------|-------|
| Jan 30 | `a495b8a` | Added sorting to Stock Register | Stock Register |
| Jan 30 | `cfb577a` | Enhanced Stock Register with filtering | Stock Register |
| Feb 15 | `c1a558d` | Implemented staff request features | Chemical Requests |
| Feb 15 | `e54d75e` | Fixed request ID collision + edit permissions | Chemical Requests |
| Feb 26-28 | 50+ commits | **Massive UI refinement series**: AddRequestModal, AddStockRegisterModal, AddDamagedEntryModal — grid layouts, dark mode, input styling, autocomplete, supplier/make selection, button designs, scrollbar, etc. | Modal components |
| Mar 1 | `0a128fb` | Transformed User Management to dashboard layout | User Management |
| Mar 1 | `edd705a` | Refined Stock Register/Request modals, added M.Sc classes | Modals + classes |
| Jun 3 | `ee6e63c` | Major UI refinement across all pages | Global UI |
| Jun 7 | `f891973` | Staff-login desktop UI | Login page |
| Jun 12 | `2bef6ba` | Dynamic low stock, inventory filter, damaged entry fix | Inventory |
| Jun 17 | `16a07e0` | PostgreSQL alignment, filter fixes, UI card layout | Multiple modules |
| Jun 21 | `95ae7c8` | Modal alignment, unit labels, settings redesign, mobile | Multiple modules |
| Jul 7 | `68af6fa` | Day Order/Hour/Purpose Type detail cards + DB migration | StockRequest, IssueRegister |
| Jul 8 | `49542d8` | Fixed IssueRegisterSerializer field name | Backend serializer |
| Jul 8 | `a1ab5c4` | Hide completed requests from main feed | StockRequest views |
| Jul 8 | `d538e5d` | Login page text update + narrower form | Login page |
| Jul 8 | `a2f11db` | Removed "(AUTONOMOUS)" text | UI text |
| Jul 9 | `0e81f89` | Confirm dialogs → toast notifications | UI behavior |
| Jul 9 | `3b5a762` | Day order/hour for damaged entries + report views | Damaged Entry + reports |
| Jul 20 | `c151a69` | Mobile dropdown overflow fix; form restructures across all form pages | Global forms |
| Jul 20 | `88a20d3` | Trigger validation fix + DRF errors in UI; stock + service migrations | Stock Entry, Service Entry |
| Jul 24 | `3ab7f06` | **Massive overhaul**: user management pages, settings redesign, detail pages rebuild, permission improvements, new E2E tests, company fields, venue column | Almost everything (41 files) |

**Does Dharani's work stay within "Chemical Request module"?**  
**No — far from it.** Dharani's commits touch almost every module in the system:
- Chemical requests (AddRequestModal, StockRequest views)
- Stock Register (AddStockRegisterModal, detail views, serializers)
- Damaged Entry (AddDamagedEntryModal, detail views)
- User Management (full overhaul — new Create/Edit pages, rebuilt list)
- Settings (complete redesign)
- Service Entry (migrations, forms, company fields)
- Login page
- Inventory (low stock alerts, filtering)
- Issue Register (detail views, venue field)
- Tests (E2E tests for chemical requests, stock request visibility)
- Global CSS (App.css, detail page CSS files)
- Permissions (backend)
- API client (AuthContext changes)

Dharani has been working across the **entire application** since late February, not just on one module.

### Sarathy's contributions (2 commits, Jan 30 – Feb 12)

| Date | Commit | Summary | Files touched | Scope |
|------|--------|---------|---------------|-------|
| Jan 30 | `aebea89` | "UI/UX enhancements and database synchronization fixes" | 21 files (frontend CSS/JS, backend sync scripts) | Added Login.css, redesigned Sidebar, Inventory page updates, and several backend DB sync/fix scripts |
| Feb 12 | `c543926` | "Enhance UI/UX: Vintage clock and inventory updates" | 44 files (massive frontend overhaul) | Added a Vintage Clock component, Notification Center, Navbar, TopBar; completely overhauled Settings, AddDamagedEntryModal, AddStockRegisterModal, Sidebar, Dark mode, Home page, and many CSS files |

**Sarathy's work** is entirely frontend UI/UX — no backend feature code. The "database synchronization fixes" in `aebea89` were scripts to sync database sequences and fix columns, which are operational scripts rather than application features.

### Date ranges

| Author | First commit | Last commit | Active period |
|--------|-------------|-------------|---------------|
| **Dharani** | 2026-01-30 | 2026-07-24 | ~6 months (active recently) |
| **Sarathy** | 2026-01-30 | 2026-02-12 | ~2 weeks (stale — not active since Feb) |

### Last updated
**2026-07-24** (6 days ago) — commit `9dd4dc1` by Nithish. This is the most recently active branch after `security-strengthening`.

---

## 4. Safety Cross-Check — Last Commit Dates

| Branch | Last commit date | Relative | Status |
|--------|-----------------|----------|--------|
| **main** | 2026-07-10 | 3 weeks ago | Stale — no activity |
| **feature/year-end-report** | 2026-07-10 | 3 weeks ago | Stale — no activity in 3 weeks |
| **fix/race-conditions-pre-deploy** | 2026-07-20 | 10 days ago | Recent |
| **ui-enhancement2** | 2026-07-24 | 6 days ago | Active |
| **security-strengthening** | **2026-07-31** | **13 minutes ago** | **Currently active (you're on it)** |

---

## 5. Open Questions (needs human clarification)

1. **What happens to `security-strengthening`'s uncommitted files?** There are 18 untracked debug/test scripts, one deleted file (`settings.py` — likely replaced by `settings/base.py`), and one modified debug script. These should either be committed, discarded, or moved to a `.gitignore`.

2. **Dharani's large July 24 commit (`3ab7f06`)**: This 41-file commit is an enormous single change. If merge conflicts arise, it may be hard to isolate what changed. Dharani should be consulted before merging `ui-enhancement2` anywhere.

3. **Sarathy's commits are from February** (over 5 months old) — and Sarathy has not contributed since. If the vintage clock or notification center components are still desired, they should be reviewed for staleness.

4. **Feature/year-end-report is no longer needed as a branch** — its feature already exists on `main` (and therefore on all other branches). The 38 unmerged commits contain valuable work (Service Entry module, Stock Register v2, hardening, password management), but those features need to be merged into `main` from this branch before it can be deleted. Alternatively, they may already exist elsewhere depending on how `main` was merged. **A human should verify:** does `main` already have the Service Entry module, Stock Register v2, password management, and Phase 1 hardening? If yes, this branch may be fully redundant.

5. **Conflict risk is real on `fix/race-conditions-pre-deploy`**: The 24-file frontend hardening commit (`24241c4`) and the 46-file feature commit (`da9aa74`) touch many files that also changed on other branches. The 3 race-condition fix commits are small and safe. Consider cherry-picking only those 3 commits (`6161cad`, `4d96369`, `f7c109c`) rather than merging the whole branch.

6. **`ui-enhancement2` ownership**: Dharani has done extensive work across the entire codebase, not just chemical requests. Before merging, confirm with Dharani that the branch is ready and there are no uncommitted changes on their end.
