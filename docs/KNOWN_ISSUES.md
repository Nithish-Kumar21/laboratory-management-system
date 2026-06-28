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
