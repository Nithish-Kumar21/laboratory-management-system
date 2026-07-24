# Known Issues

## 1. Mobile bottom nav overlay blocks form submit buttons (HIGH)

- Fixed-position bottom nav bar overlaps action buttons at 375x812 viewport
- Workaround in E2E tests: programmatic element.click() via page.evaluate()
- Needs proper frontend fix: add padding-bottom to content area or adjust z-index
- Affected pages: NewStockRegister, NewDamagedEntry, NewChemicalRequest

## 2. Draft card links to detail page, Submit button only on edit page (MEDIUM)

- Draft card navigates to /requests/{id} (detail page) -- no Submit button there
- Submit button only exists on /new-request?edit={id} (edit page)
- Confusing UX -- user cannot submit from the detail view of their own draft
- Frontend team should add Submit action to draft detail page or fix card link

## 3. Staff unreported session has no timeout enforcement (MEDIUM)

- Staff blocked from new requests until previous session is reported
- No deadline or escalation if staff never reports
- HOD not notified of overdue unreported sessions
- Recommended: add deadline field (e.g. 24-48hrs after lab session date) + HOD notification

## 4. API blocks deletion of accepted/issued/reported requests (by design)

- Only draft, pending, rejected requests are deletable via API
- E2E test isolation requires e2e_cleanup management command to bypass this

## 5. First-login password change not enforced (SECURITY -- HIGH)

- HOD-created user accounts have no forced password reset on first login
- Flag for Phase 2 security hardening

## 6. Permission Dialog False-Positive on Reject Request (FIXED)

**Root cause**: Stale frontend user state — role stored in localStorage at login was never refreshed against the backend.

**Mechanism**:
- Frontend `AuthContext.checkAuth()` reads user role from `localStorage` (set at login) and never verifies it against the DB
- `isHOD` derives from the stored `user.role` field: `user?.role === 'hod'`
- If a user's role changes in the DB after login (e.g., HOD → staff), the frontend still shows `isHOD: true`, renders the Reject button, but the backend reads the current role from the DB and returns 403 "Only HOD can reject requests"
- The 403 error is displayed in the ConfirmDialog, giving a false-positive permission error

**Scope**: This same stale-state issue affected ALL role-gated backend actions (accept, reject, mark_as_issued, complete), not just reject. The reject action was the most visible because HODs are the primary reviewers.

**Fix**: `AuthContext.checkAuth()` now calls `GET /users/me/` on app load and syncs the role if it differs from localStorage. See `frontend/src/context/AuthContext.js:30-41`.

**Architecture note**: Roles are checked inline in each backend action method (`views.py:135,240,443,475`), not via a shared permission class. The `StockRequestPermission` class only enforces HTTP method per role, not action-level restrictions. This is a "duplicated" pattern — each action re-checks the role independently. A shared permission class could consolidate this, but the current approach is explicit and correct.
