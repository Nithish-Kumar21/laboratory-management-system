# Product Requirements Document (PRD)
# Laboratory Management System (LMS)
**Version:** 1.0  
**Date:** April 2026  
**Author:** Nithish Kumar K  
**Status:** Active — Resume & Completion Phase

---

## 1. Purpose of This Document

This PRD defines what the LMS must do, to what standard, and in what priority order to reach production deployment for the Chemistry Department at Guru Nanak College.

This is not a complete rewrite. A significant portion of the system is already built. This document reflects current reality, identifies gaps, and gives any AI agent or developer a clear, unambiguous build target.

**Do not treat the SRS as the source of truth. This PRD supersedes it where they conflict.**

---

## 2. Product Summary

The LMS is a web application that digitizes the Chemistry Department's laboratory management workflows. It replaces manual paper registers with a role-based digital system for:

- Managing chemical and apparatus inventory
- Processing staff requests for lab sessions
- HOD approval/rejection of those requests
- Storekeeper issuance and tracking
- Staff usage reporting after sessions
- Year-end stock report generation

**Users:** ~1 HOD, ~1–2 Storekeepers, ~15–20 Teaching Staff  
**Access:** Progressive Web App (PWA) — mobile-first. Primary use on mobile phones, secondary on desktop, tertiary on tablets and iPads.  
**Tech Stack:** Django 5.2 + DRF, React 19, PostgreSQL, JWT  
**Deployment Target:** Linux server (local or cloud — environment-agnostic build required)

> **Mobile-First Design Principle:** Every UI component, layout, form, and workflow must be designed for mobile screens first. Desktop layout is an enhancement. There is zero tolerance for UI that works on desktop but is unusable on mobile. All touch targets, form inputs, dropdowns, and modals must be thumb-friendly and tested at 375px viewport width as the baseline.

---

## 3. Roles & Access

| Role | Key Capabilities |
|---|---|
| **HOD** | Approve/reject requests, view all inventory, manage users, generate reports, view audit logs |
| **Storekeeper** | Add stock, issue chemicals, complete requests, manage damage reports |
| **Staff** | Create requests, submit usage reports, view own request history, view inventory (read-only) |

RBAC is enforced at the API level on every endpoint. Frontend menus reflect role permissions. Unauthorized access returns `403 Forbidden`.

---

## 4. Current State Summary (as of April 2026)

The following is already built and functional:

| Module | Status | Notes |
|---|---|---|
| User auth (JWT, login, lockout) | ✅ Built | 8hr/7d expiry, 5-attempt lockout, rotation enabled |
| RBAC enforcement | ✅ Built | Tested via `tests_rbac.py` |
| Inventory (chemicals & apparatus) | ✅ Built | View, reorder level management |
| Stock Register (procurement) | ✅ Built | Invoice logging, FK issue (see gaps) |
| 7-State Request Workflow | ✅ Built | draft→pending→accepted→rejected→issued→reported→completed |
| Damage Entry | ✅ Built | Photo upload, staff tracking |
| Basic Dashboard | ✅ Built | Recharts in use |
| React frontend routing | ✅ Built | Protected routes per role |

The following is **not yet built** or has critical gaps:

| Missing Feature | Priority |
|---|---|
| In-app notification system | High |
| Audit logging | High |
| Year-end & custom report generation (PDF/Excel) | High — client's #1 requirement |
| Password complexity enforcement | High |
| Mandatory first-login password change flow | High |
| Degree field on User model + degree-based class filtering in requests | High |
| Cancellation workflow for pending requests | High |
| SECRET_KEY no-fallback enforcement | High |
| Frontend API URL via environment variable | High |
| CORS production configuration | High |
| Unmanaged models resolution (`IssueRegister`, `IssueChemicals`) | High — unknown risk |
| `DO_NOTHING` → `PROTECT` fix on procurement FK | Medium |
| Reorder level mandatory on new item creation | Medium |
| No-negative-quantity enforcement at API level | Medium |
| End-to-end test coverage for workflow | Medium |
| Settings split (dev/prod) | Medium |
| Email notifications | Low |
| Push notifications (Web Push API) | Low |
| PWA offline support | Low |

---

## 5. Functional Requirements

### 5.1 User Management

**F-UM-1: User Creation (HOD/Admin only)**
- HOD creates accounts for all users. No self-registration.
- Required fields: Full Name, Employee ID (unique), Role, Email, Phone, Department, Degree, Password
- **Department:** PG and Research Programme of Chemistry (GAS) — this is fixed for this release (single department)
- **Degree** (mandatory for new Staff account creation):
  - B.Sc Chemistry
  - M.Sc Chemistry
  - PhD
  - HOD and Storekeeper accounts do not require a degree assignment
  - Existing user accounts may have this field blank — HOD can update degree via the user management UI at any time
  - The degree field is nullable at the database level
- System validates: Employee ID uniqueness, email format, phone is 10 digits
- Password set by HOD at account creation (pre-set password). Must still meet complexity rules.
- On success: account is immediately active. HOD hands over the Employee ID and pre-set password to the user directly.

**F-UM-1a: Mandatory Password Change on First Login**
- On first login, the system detects `is_first_login = True` on the user record
- User is redirected to a mandatory password change screen before accessing any other page
- The new password must meet complexity rules and cannot be the same as the pre-set password
- On successful change, `is_first_login` is set to `False` and the user proceeds to their dashboard
- No page other than the password change screen is accessible during this flow — direct URL access must redirect back

**F-UM-2: Authentication**
- Login via Employee ID + Password
- Returns JWT access token (8hr) + refresh token (7d)
- Role-specific dashboard redirect after login
- 5 failed attempts trigger 30-minute account lockout
- Lockout must return a clear message with unlock time

**F-UM-3: Password Security**
- Complexity rules: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character (@#$%&*), cannot equal Employee ID
- On first login: new password cannot be the same as the pre-set password assigned by HOD
- Real-time validation feedback shown during password entry
- Passwords are never stored in plain text
- All API endpoints check role before processing
- Frontend renders only role-permitted navigation items
- API returns `403 Forbidden` on unauthorized access — never `404`

---

### 5.2 Inventory Module

**F-INV-1: View Inventory**
- All roles can view available chemicals and apparatus
- **HOD and Storekeeper display:** Name, Available Quantity, Unit, Reorder Level, Stock Status
- **Staff display:** Name, Available Quantity, Unit, Stock Status (no supplier, invoice, rate, or reorder level visible)
- Stock Status: `Available` / `Low Stock` (quantity ≤ reorder level) / `Out of Stock` (quantity = 0)
- **No negative quantity is permitted under any circumstance.** Any operation that would result in a negative available quantity must be blocked at the API level with a clear error. This includes issue, damage reporting, and manual adjustments.

**F-INV-2: Add Stock Entry (Storekeeper only)**
- Invoice Number (unique), Purchase Date (not future), Supplier Name
- For each line item (chemical or apparatus) on the invoice: Name, Quantity, Rate, Make, and Reorder Level
- **Reorder level handling:**
  - If the item already exists in inventory: the current reorder level is pre-filled and displayed. Storekeeper may update it if needed.
  - If the item is new (does not yet exist in inventory): the reorder level field is mandatory and cannot be left blank before submitting.
- On save: available stock for that item is incremented by the invoice quantity
- Duplicate invoice number returns error: `"Invoice number already exists"`

**F-INV-3: Reorder Level Management**
- Reorder level is set at the time of stock entry (see F-INV-2)
- HOD or Storekeeper can also update the reorder level on existing items independently of a new stock entry
- Low stock condition is evaluated against this level on every stock change

---

### 5.3 Stock Request Workflow

This is the core of the system. All 7 states must be enforced at the API level.

**States and transitions:**

```
draft → [submit] → pending → [approve] → accepted → [issue] → issued → [staff reports] → reported → [storekeeper confirms] → completed
                          ↘ [reject] → rejected
```

- `draft`: Created by Staff. Editable. Deletable. Cannot submit if another non-draft active request exists.
- `pending`: Submitted. Locked from edit. HOD sees it.
- `accepted`: HOD approved. Storekeeper sees it in issuance queue.
- `rejected`: HOD rejected. Must include `rejection_reason` (min 10 chars). Staff can create a new request.
- `issued`: Storekeeper marked as issued. **Inventory is decremented at this point.**
- `reported`: Staff submitted actual usage quantities. `used_qty + returned_qty` must equal `issued_qty`. Validation is strict.
- `completed`: Storekeeper confirmed. **Inventory is incremented by `returned_qty`.**

**F-REQ-1: Create Request (Staff)**
- Multi-chemical selection from available inventory (staff sees only name, quantity, unit, status)
- Fields per chemical: quantity requested (must not exceed available)
- Fields on request: Date of Use, Lab Hour Slot, Class, Purpose/Experiment Name
- **Class dropdown is filtered by the staff member's assigned degree.** A staff member assigned to B.Sc Chemistry will only see B.Sc Chemistry classes in the dropdown. M.Sc and PhD classes will not appear. This logic is enforced on the backend — not just the frontend — so it cannot be bypassed via API.
- This filtering is intentionally designed to be easily overridable in the future. If a staff member needs cross-degree access, it should be achievable by updating only the user's degree assignment or a backend permission flag — no structural changes required.
- Cannot select date in the past
- Cannot submit if quantity > available stock at time of submission

**F-REQ-2: Submit Request (Staff)**
- Moves draft → pending
- Locked for edit after submission
- Staff must cancel and recreate if changes are needed

**F-REQ-3: Cancel Request (Staff)**
- Only allowed when status is `pending` (not yet reviewed by HOD)
- Requires confirmation. Sets status to `cancelled`.
- Cancelled requests are archived, not deleted

**F-REQ-4: Approve/Reject (HOD)**
- Approve: optional remarks, moves to `accepted`
- Reject: mandatory reason (min 10 chars), optional suggestions, moves to `rejected`
- HOD cannot modify quantities — approve or reject the full request as-is

**F-REQ-5: Issue (Storekeeper)**
- Storekeeper confirms physical handover of chemicals
- Moves to `issued`, inventory decremented using `select_for_update()` to prevent race conditions
- Cannot issue if current available stock < requested quantity — must alert Storekeeper

**F-REQ-6: Report Usage (Staff)**
- Staff submits for each chemical: `used_quantity` and `returned_quantity`
- Validation: `used_quantity + returned_quantity == issued_quantity`
- Moves to `reported`

**F-REQ-7: Complete (Storekeeper)**
- Storekeeper confirms physical return of items
- Moves to `completed`, inventory incremented by `returned_quantity`
- Creates/updates Issue Register entry

---

### 5.4 Damage Reporting

**F-DMG-1: Create Damage Report**
- Fields: Staff name, Class/Lab session, Caused By, Apparatus (multi-select), Quantity Damaged, Incident Description, Date of Damage
- Only apparatus can be damaged (not chemicals)
- Submitting a damage report immediately decrements apparatus available quantity
- HOD can view all damage reports

---

### 5.5 In-App Notification System

**F-NOT-1: Notification Model**
- Each notification has: recipient (FK User), type, message, related object ID, `is_read` (bool), `created_at`
- Notifications are created on the following events:

| Event | Recipients |
|---|---|
| Request submitted | HOD |
| Request approved | Staff, Storekeeper |
| Request rejected | Staff |
| Request issued | Staff |
| Usage reported | Storekeeper |
| Request completed | Staff |
| Low stock triggered | HOD, Storekeeper |
| Damage report filed | HOD |

**F-NOT-2: Notification Bell UI**
- Bell icon in top nav with unread count badge
- Dropdown shows last 10 notifications with timestamp
- Clicking a notification navigates to relevant page and marks it as read
- "Mark all as read" action
- Dedicated notifications page with full history (last 30 days)

> **Note:** Real-time WebSocket delivery is deferred. Notifications are created server-side and polled every 30 seconds from the frontend. WebSocket upgrade can be done post-deployment.

---

### 5.6 Audit Logging

**F-AUD-1: Audit Log Model**
- Fields: `user` (FK), `action` (enum), `entity_type`, `entity_id`, `description`, `ip_address`, `timestamp`
- Audit records are **immutable** — no update or delete permitted via API or admin

**F-AUD-2: Actions to Log**
All of the following must be automatically logged without manual trigger in views:
- User created, deactivated, password changed
- Stock entry added, edited
- Request created, submitted, approved, rejected, cancelled, issued, completed
- Damage report created
- Report generated
- Login success, login failure

**F-AUD-3: Audit Log Viewer (HOD only)**
- Paginated list of all audit entries
- Filter by: user, action type, date range
- Non-editable, non-deletable from UI

---

### 5.7 Reporting Module

**F-RPT-1: Year-End Stock Report (Client Priority #1)**
- Generates a summary of inventory state over a selected date range
- Report includes for each chemical and apparatus:
  - Opening Stock
  - Total Purchased in Period
  - Total Used in Period
  - Total Damaged in Period
  - Closing Stock (current available)
- Export formats: PDF (print-ready), Excel (.xlsx), CSV
- PDF must include: Department name, date range, generation timestamp
- Available to HOD and Storekeeper

**F-RPT-2: On-Demand Report**
- User selects date range, report type (Chemicals / Apparatus / Both)
- Report generates within 10 seconds for up to 1000 items

**F-RPT-3: Dashboard Analytics**
- HOD dashboard: Pending approvals count, Low stock item count, Recent bookings (last 7 days), Month-wise usage bar chart (Recharts)
- Storekeeper dashboard: Approved bookings pending issue, Pending returns count, Recent purchases
- Staff dashboard: Active request status, Upcoming lab sessions

---

## 6. Non-Functional Requirements

### 6.1 Security

| Requirement | Specification |
|---|---|
| Password hashing | Django's default PBKDF2 or Argon2. Minimum complexity enforced. |
| JWT | Access: 8hr, Refresh: 7d, rotation enabled. No fallback `SECRET_KEY`. |
| CORS | Configured via environment variable. `localhost` only in dev. Explicit origins in production. |
| DEBUG mode | Must be `False` in production. Enforced via env, not hardcode. |
| Input validation | All validation happens on the backend. Frontend validation is UX only. |
| SQL injection | Django ORM only. No raw SQL. |
| CSRF | DRF's `SessionAuthentication` requires CSRF. JWT-only endpoints are exempt but must be explicitly configured. |
| Unauthorized access | Returns `403` with no information leak. Logged in audit. |

### 6.2 Performance

| Requirement | Target |
|---|---|
| Page load time | Under 2 seconds on local college network |
| Search/filter response | Under 500ms |
| Report generation | Under 10 seconds for 1000 items |
| Concurrent users | 50 users without degradation |

### 6.3 Reliability

- All inventory quantity changes (issue, complete, damage) use database transactions with `select_for_update()` to prevent race conditions
- Database migrations must be clean and reproducible from scratch
- No orphaned FK records — all relationships use `CASCADE` or `PROTECT`, never `DO_NOTHING`

### 6.4 Usability

- Error messages must be in plain English — no stack traces or technical jargon to users
- Every form field must have inline validation feedback
- Loading states on all async actions (no frozen UI)
- Responsive layout supporting desktop (1920x1080) and tablet (1024x768)
- Role-specific navigation — users never see links to pages they cannot access

### 6.5 Environment & Configuration

- All environment-specific values live in `.env` files — never hardcoded
- Required env variables: `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `DEBUG`
- `SECRET_KEY` must have no default fallback in `settings.py` — the app must fail loudly if it's missing
- Settings split into `settings/base.py`, `settings/dev.py`, `settings/prod.py`
- Frontend API base URL via `REACT_APP_API_BASE_URL` environment variable

---

## 7. Out of Scope (For This Release)

The following items from the SRS are explicitly deferred. Do not build these unless all in-scope items are complete and verified.

- Web Push Notifications (browser-level)
- Email notifications (SMTP)
- WebSocket real-time updates (polling is sufficient for v1)
- PWA offline support beyond what's already registered
- Advanced filter builder with save/share
- Bulk HOD approval
- Department-wise analytics breakdown (B.Sc vs M.Sc)
- Auto-scheduled report generation (cron)
- Multi-department support
- Vendor/supplier management
- Integration with any external system

---

## 8. Known Technical Risks (Must Resolve Before Building)

| Risk | Description | Resolution Required |
|---|---|---|
| Unmanaged Models | `IssueRegister` and `IssueChemicals` in `stock_request` are `managed=False`. It is unknown if these DB tables exist, what they contain, or if any views/serializers depend on them. | Inspect DB and codebase. Either manage them properly or remove them. |
| `DO_NOTHING` FK | `ChemicalItem` and `ApparatusItem` use `DO_NOTHING` when their parent `StockRegister` is deleted, risking orphaned records. | Change to `PROTECT` (prevent deletion if items exist). |
| SECRET_KEY fallback | `settings.py` has a hardcoded default insecure key. | Remove fallback. Use `os.environ['SECRET_KEY']` directly — crash if missing. |
| Hardcoded frontend URL | `src/utils/api.js` uses `http://127.0.0.1:8000/api/` directly. | Replace with `process.env.REACT_APP_API_BASE_URL`. |
| CORS localhost-only | Will break in any non-localhost deployment. | Move to env-based `CORS_ALLOWED_ORIGINS`. |

---

## 9. Build Priority Order

Complete in this sequence. Do not move to the next phase until the current one is verified.

### Phase 1 — Harden Foundation (No new features)
1. Resolve unmanaged models
2. Fix `DO_NOTHING` → `PROTECT` on procurement FKs
3. Remove `SECRET_KEY` fallback
4. Move frontend API URL to env variable
5. Move CORS to env variable
6. Add settings split (base / dev / prod)
7. Verify password complexity enforcement exists — add if missing
8. Add `is_first_login` field to User model + mandatory password change flow on first login
9. Add `degree` field to User model (B.Sc Chemistry / M.Sc Chemistry / PhD). The DB column must be `nullable` — existing user accounts will have no degree set and that is acceptable. HOD can manually assign degrees to existing staff accounts via the user management UI after migration. The degree field is only enforced as mandatory on new Staff account creation going forward.
10. Add cancellation workflow for pending requests
11. Enforce no-negative-quantity at API level on all stock-reducing operations
12. Enforce reorder level as mandatory on new item creation in stock entry

### Phase 2 — Build Missing Core Features
1. Audit logging (model + middleware auto-logging + HOD viewer)
2. In-app notification system (model + creation on events + bell UI + polling)
3. Year-end report generation — PDF and Excel export
4. On-demand custom report with date range filter

### Phase 3 — Test & QA
1. Write backend tests for all workflow state transitions
2. Write backend tests for inventory math (issued → completed inventory delta)
3. Manual end-to-end UAT for each role's full journey
4. Fix all failures before proceeding

### Phase 4 — Deployment Readiness
1. Write `DEPLOYMENT.md` — exact steps to run from a fresh Linux server
2. Confirm all env variables are documented
3. Test production settings build (DEBUG=False, real SECRET_KEY)
4. Final UAT with a real user from the department if possible

---

## 10. Acceptance Criteria (Minimum for Deployment)

The system is ready for real-world use when all of the following are true:

- [ ] Staff can create, submit, and cancel requests end-to-end
- [ ] HOD can approve and reject with mandatory reason
- [ ] Storekeeper can issue, staff can report usage, storekeeper can complete
- [ ] Inventory quantities are mathematically correct across all state transitions
- [ ] RBAC blocks cross-role access on every tested endpoint
- [ ] Year-end report downloads as PDF and Excel with correct data
- [ ] Audit log captures all key actions
- [ ] In-app notifications delivered on all key events
- [ ] No hardcoded secrets, URLs, or localhost-only config in production build
- [ ] App runs correctly with DEBUG=False
- [ ] All workflow tests pass
- [ ] Zero `500 Internal Server Error` responses on known input combinations
