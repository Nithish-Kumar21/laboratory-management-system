# Git Branch Investigation Round 2 — Feature Confirmation Report

**Date:** 2026-07-31  
**Branches examined:** `main`, `security-strengthening`, `ui-enhancement2`

---

## 1. Does `main` Already Have the Features from `feature/year-end-report`?

### 1a. Service Entry Module

| Check | Result |
|-------|--------|
| `backend/service_entry/__init__.py` exists? | **YES** — the full Django app exists on `main` |

**Verdict: Present on main.** The Service Entry module (CRUD, E2E tests, session docs from commit `7c9fb69`) was merged into `main` via one of the merge commits. This branch's work is already deployed.

---

### 1b. Stock Register V2 Fields

| Check | Result |
|-------|--------|
| `pack_size` field in `stock_register/models.py`? | **YES** — `pack_size = models.DecimalField(max_digits=10, decimal_places=2)` |
| `no_of_packs` field? | **YES** — `no_of_packs = models.IntegerField(default=1)` |
| `total_quantity` field? | **YES** — `total_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)` |
| `supplier_contact_country_code` field? | **YES** — present |
| `supplier_contact_phone` field? | **YES** — present |
| `supplier_email` field? | **YES** — present |

**Verdict: Present on main.** All Stock Register v2 fields (from commit `611584a`) exist on `main`. The migration and schema changes are deployed.

---

### 1c. Password Management System

| Check | Result |
|-------|--------|
| `backend/users/email_utils.py` exists? | **YES** — contains `send_password_reset_email` and `send_welcome_email` functions using Gmail SMTP |
| `PasswordComplexityValidator` in `validators.py`? | **YES** — class found |
| `frontend/src/components/ChangePassword.js` exists? | **YES** — first-login flow with temp token, old/new password, eye toggle, PasswordChecklist |
| `frontend/src/components/ForgotPassword.js` exists? | **YES** — employee_id + email form, sends reset link |
| `frontend/src/components/ResetPassword.js` exists? | **YES** — token verification, new password form, redirect to login |
| `docs/DEPLOYMENT.md` exists? | **YES** — full HOD setup checklist, password management docs |

**Verdict: Present on main.** The entire password management system (from commit `106c5ba`) — first-login flow, forgot/reset password, Gmail SMTP, complexity validator, and deployment docs — all exist on `main`.

---

### 1d. Phase 1 Hardening

| Check | Result |
|-------|--------|
| `backend/audit/__init__.py` exists? | **YES** — audit app exists |
| `backend/backend/settings/base.py` exists? | **YES** — full settings split in place (contains INSTALLED_APPS with `audit` and `service_entry`, middleware with `FirstLoginMiddleware`, JWT config, email config, logging, etc.) |
| `backend/backend/settings/dev.py` exists? | **YES** — dev overrides (DEBUG=True, SQL logging) |
| `backend/backend/settings/prod.py` exists? | **YES** — production overrides (DEBUG=False, SSL-ready) |
| `FirstLoginMiddleware` referenced? | **YES** — `'users.middleware.FirstLoginMiddleware'` in MIDDLEWARE |
| Idempotency key handling? | **YES** — found in inventory models |
| Degree-based class filtering middleware? | **YES** — `FirstLoginMiddleware` includes degree class checks |

**Verdict: Present on main.** Phase 1 hardening (from commit `d77676c`) — audit app, settings split, first-login enforcement, degree filtering, idempotency — all exist on `main`.

---

### 1e. Summary

| Feature | Status on main |
|---------|---------------|
| Year-End Report (d4f4f6a) | Present |
| Service Entry module (7c9fb69) | Present |
| Stock Register v2 (611584a) | Present |
| Password Management (106c5ba) | Present |
| Phase 1 Hardening (d77676c) | Present |

**All features from `feature/year-end-report` are already on `main`.** The 38 unmerged commits on that branch consist of (a) fixes and refinements to features already deployed, (b) Dharani's UI work that is also present via `ui-enhancement2`, and (c) merge artifacts/debug scripts. The branch as a distinct entity is **fully redundant**.

---

## 2. Are `da9aa74` and `24241c4` Fixes Superseded Elsewhere?

### 2a. Company/Vendor Fields, Venue Field, Unit Selector (from `da9aa74`)

| Check | `security-strengthening` | `ui-enhancement2` |
|-------|--------------------------|--------------------|
| `venue` field in `stock_request/models.py`? | **YES** — `venue = CharField(max_length=100, blank=True, default='B.Sc Chemistry Laboratory')` | **YES** — same field present |
| `company_name` / `company_address` in `service_entry/models.py`? | **YES** — `company_name`, `company_address`, `company_contact_country_code`, `company_contact_number` all present | **YES** — identical fields present |

**Verdict: Fully superseded.** All fields from `da9aa74` exist on both `security-strengthening` and `ui-enhancement2`. The architecture docs and schema dumps added by that commit are also present. The da9aa74 commit is unnecessary — its feature work is already deployed.

### 2b. Token Refresh Single-Flight, NaN Guards, Null Safety (from `24241c4`)

| Check | `security-strengthening` | `ui-enhancement2` |
|-------|--------------------------|--------------------|
| Single-flight token refresh in `api.js`? | **YES** — `isRefreshing` flag with `// Single-flight token refresh` comment found | **YES** — identical code present |
| Same pattern in `AuthContext.js`? | **YES** | **YES** |

**Verdict: Fully superseded.** The critical reliability fixes from `24241c4` (single-flight token refresh, NaN guards, null safety) are already in place on both `security-strengthening` and `ui-enhancement2`. The remaining changes in that commit (CSS tweaks, button rearrangements, debug log removal) are minor and either already applied or irrelevant.

---

## 3. Sarathy's Stale Components — Still Present?

| Component | Still on `ui-enhancement2`? |
|-----------|----------------------------|
| `frontend/src/components/NotificationCenter.js` | **YES** — still present |
| `frontend/src/components/NotificationCenter.css` | **YES** — still present |
| `frontend/src/layout/Navbar.js` | **YES** — still present |
| `frontend/src/layout/Navbar.css` | **YES** — still present |
| `frontend/src/layout/TopBar.js` | **YES** — still present |
| `frontend/src/layout/TopBar.css` | **YES** — still present |
| `frontend/src/pages/VintageClock.css` | **YES** — still present |

**Verdict: Still present and active.** None of Sarathy's components have been removed or replaced by Dharani's subsequent work. The Notification Center, Navbar, TopBar, and Vintage Clock all still exist in `ui-enhancement2`'s current file tree. However, these components were last touched by Sarathy in **February 2026** (5 months ago). They may still work, but they haven't been actively maintained.

---

## 4. Summary of Decisions This Enables

| Branch | What to do with it |
|--------|-------------------|
| `feature/year-end-report` | **Can be safely deleted.** All its features are already on `main`. The 38 unmerged commits are either already deployed or came from other branches. |
| `fix/race-conditions-pre-deploy` | The 3 race-condition fixes (`6161cad`, `4d96369`, `f7c109c`) are **not** on `main` and are valuable. The other 5 commits are fully superseded. Consider cherry-picking only those 3 commits. |
| `ui-enhancement2` | Active branch with Dharani's latest work (Jul 24). Sarathy's old components are still present. Must be merged (or cherry-picked) to bring changes to `main`. |
| `security-strengthening` | Currently active. Contains race-condition fixes plus uncommitted changes. Needs to be committed and merged to `main`. |
