# SESSION_PROMPT — Phase 1 Hardening: Idempotency, Settings Split, Business Logic, Audit Log

**Response style:** Telegraphic. No narration before tool calls. State findings, not process. Do not summarize what you're about to do — just do it, then report results.

**Read first:** `PRD.md`, `TECHNICAL_SPEC.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`

**Do not advance to the next task until the current task is verified working. Report verification evidence (test output, manual check result) before moving on.**

---

## Task 0 — Schema/Unit Verification (read-only, confirm before touching anything)

Context: `quantity_ml` on chemical-related models was intentionally split into a generic `quantity` field plus a separate `unit` column (`ml` / `g`) to support both liquid and powder chemicals. This is a **deliberate decision**, not a bug.

1. Confirm in the actual database schema and current `models.py` files (`inventory`, `stock_register`, `stock_request`) whether this split is already implemented.
2. Report: which models have the `unit` column, what type it is (CharField with choices vs free text), and whether `iexact`/case-insensitive matching still works correctly against `chemical_name`.
3. **Question for me to answer before you proceed:** is `unit` currently constrained to a fixed choice set (`ml`, `g`) at the serializer/model level, or is it free text? Flag this explicitly — do not assume either way.
4. Do NOT modify this unless instructed in a later task. This is a confirm-and-report step only.

---

## Task 1 — Idempotency Guards on State Transitions

Reference: TECHNICAL_SPEC.md Section 11 (Idempotency), Section 5 (State Transition Guards).

Apply idempotency guards to every state-changing endpoint in the `StockRequest` workflow: submit (draft→pending), cancel (pending→cancelled), accept (pending→accepted), reject (pending→rejected), issue (accepted→issued), report usage (issued→reported), complete (reported→completed).

Pattern per spec: if the request is already in the target state, return `200` with a "already X" message — do not error, do not re-run side effects (inventory decrement/increment must not fire twice). If the request is in a state where the transition is invalid, return `400`.

1. Audit current state of each transition endpoint — which already have guards, which don't.
2. Implement missing guards exactly per the early-return pattern in Section 11.
3. Wrap any transition with inventory side effects in `@transaction.atomic` + `select_for_update()` on the inventory row, per Section 1 architecture rules.
4. **Test:** write/run a test that calls the same transition endpoint twice in a row and asserts (a) second call returns 200 with the "already" message, (b) inventory quantity changed exactly once, not twice.
5. Report pass/fail per transition.

---

## Task 2 — Settings Split (base/dev/prod) + Env Cleanup

Reference: TECHNICAL_SPEC.md Section 10 (Environment & Configuration), Section 1 (no hardcoded values).

1. Split current single `settings.py` into `settings/base.py`, `settings/dev.py`, `settings/prod.py` per standard Django pattern. `base.py` holds shared config; `dev.py`/`prod.py` override `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, database config, logging level.
2. `DEBUG=False` enforced in `prod.py`. No exceptions.
3. Confirm CORS is locked to explicit allowed origins in prod — no wildcard.
4. Find and remove the hardcoded API URL in the frontend. Move it to a frontend `.env` (e.g. `VITE_API_BASE_URL` or equivalent depending on build tool).
5. Confirm no secrets, URLs, or environment-specific strings remain hardcoded anywhere in backend or frontend source.
6. **Test:** confirm server boots correctly under both `dev` and `prod` settings modules locally (prod can be tested with a local Postgres + DEBUG=False, doesn't need real deployment).
7. Report what was hardcoded and where it now lives.

---

## Task 3 — Business Logic Completion

Reference: TECHNICAL_SPEC.md Section 4 (Business Logic Rules), Section 2.1 (User constraints).

Verify and complete:
1. **Draft limits** — confirm there's an enforced limit on number of draft `StockRequest` records a staff member can hold simultaneously (check PRD/spec for the exact number if unclear — flag if not specified anywhere and ask before guessing).
2. **First-login enforcement** — confirm `is_first_login=True` blocks access to all endpoints except `/api/auth/change-password/` until password is changed. Confirm `is_first_login` flips to `False` only on successful password change.
3. **Degree-based class filtering** — confirm `/api/classes/` filters strictly by `request.user.degree` server-side, ignoring any client-supplied query param (Section 3.3). Write a test that attempts to pass a different degree as a query param and asserts it's ignored.
4. Report current state of each (already correct / fixed / blocked on missing spec detail).

---

## Task 4 — Audit Log Build

Reference: TECHNICAL_SPEC.md Section 2.14 (AuditLog model), Section 8 (Audit Log Actions).

1. Build `audit/models.py` `AuditLog` model exactly per spec: `user` (SET_NULL), `action`, `entity_type`, `entity_id`, `description`, `ip_address`, `timestamp`.
2. Enforce immutability: override `save()` to raise if `pk` already exists (no updates), override `delete()` to raise (no deletes, ever).
3. Wire audit logging into the state transitions hardened in Task 1 — every transition (submit, accept, reject, issue, report, complete, cancel) creates one `AuditLog` entry with the actor, action, entity, and a human-readable description.
4. Also log: user creation, user deactivation, password changes (not the password itself — just that it happened), stock register creation.
5. Capture `ip_address` from `request.META.get('REMOTE_ADDR')` (or `X-Forwarded-For` if behind a proxy — flag which applies to current deployment).
6. **Test:** trigger a transition, confirm exactly one immutable AuditLog row is created with correct fields. Attempt to update/delete an AuditLog row directly and confirm it raises.
7. Report.

---

## Out of scope for this session
- Notifications app — deferred pending event scoping, do not build.
- Any frontend visual/UX work beyond the hardcoded API URL fix in Task 2.

## End of session
Summarize: what was verified vs fixed vs blocked, any spec ambiguities hit (especially draft limit count), and current % standing per area if estimable.
