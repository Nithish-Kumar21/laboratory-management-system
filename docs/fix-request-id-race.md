# Fix: Request ID Generation Race (500 instead of 400 on TOCTOU test)

## Context

Branch `fix/race-conditions-pre-deploy` (commit 4d96369) added `select_for_update()` to prevent duplicate active stock requests from the same staff member. Locust concurrency testing (`backend/tests/load/test_race_conditions.py`) confirms the lock itself works — the second concurrent request correctly gets blocked from seeing itself as "no active request exists."

However, the test surfaced a second, separate bug in the same code path: when two POST requests to `/api/stock_request/` fire concurrently for the same staff user, the response is `201 + 500` instead of the expected `201 + 400`. The `select_for_update()` fix is doing its job on the active-request check, but the **request ID generation itself is not protected from concurrent access**, so both requests proceed to generate/assign an ID before the second one's active-request check would normally reject it, and they collide on ID uniqueness, causing an unhandled exception (500) rather than a clean validation rejection (400).

## Task

1. **Locate the request ID generation logic** for `stock_request` — find whether IDs are generated via:
   - A Python-side `SELECT MAX(id) + 1` or similar pattern (this is the likely culprit — this pattern is not concurrency-safe even with locking elsewhere, since it and the active-request check may not be locking the same resource, or may be running outside the same lock scope)
   - A PostgreSQL sequence (`nextval()`), which would already be concurrency-safe at the DB level — if this is the case, investigate why a collision is still happening (e.g. is the ID being generated in Python before the row insert, then reused, causing a stale value?)
   - A manually constructed ID (e.g. date-based reference number with a running counter) — if so, this is very likely the source, since running counters computed in application code are a classic race condition source.

2. **Fix depends on what's found:**
   - If it's a Python-side `MAX + 1` or manual counter pattern: move ID generation inside the same `select_for_update()` / `@transaction.atomic` block already protecting the active-request check, so both the uniqueness check and ID assignment happen under the same lock, serialized correctly.
   - If it's a DB sequence already, but still colliding: the code is likely generating/previewing an ID in Python before the atomic insert commits — remove any pre-generation step and let the DB assign the ID at insert time, or move whatever preview logic exists inside the atomic block.
   - In either case, add a `try/except` around the actual insert to catch an `IntegrityError` (or equivalent DB uniqueness violation) as a fallback safety net, and return a clean `400` with a message like "A request is already in progress, please try again" instead of letting it bubble up as a 500. This is a fallback, not a substitute for fixing the underlying race — both should be done.

3. Do not change the `select_for_update()` logic added in commit 6161cad for the active-request check itself — that part is confirmed working by the Locust test. This fix is specifically for the ID generation step.

## Investigation Steps

1. Read `backend/stock_request/views.py` and `backend/stock_request/serializers.py` (`perform_create` and `StockRequestCreateSerializer`) to find exactly where/how the request ID or reference number is generated.
2. Trace whether that generation happens before, during, or after the `select_for_update()` lock currently in place.
3. Confirm the fix by re-running the existing Locust test (`backend/tests/load/test_race_conditions.py`) — Scenario 1 should now show `1 success (201) + 1 clean rejection (400)` consistently across multiple iterations, not a 500.

## Constraints

- Do not modify Scenarios 2 or 3 or their underlying `select_for_update()` fixes — those passed and should not be touched.
- No Python-level inventory math — not applicable here, but restating the standing project rule for consistency.
- Keep this fix scoped to request ID generation only — do not expand into other fields on the request creation flow.
- Commit to the same branch (`fix/race-conditions-pre-deploy`).

## Verification Checklist (for Nithish to run manually)

- [ ] Review diff — confirm ID generation now happens inside the existing atomic/lock block, or a proper `IntegrityError` fallback was added (ideally both)
- [ ] Re-run `python tests/load/test_race_conditions.py --iterations 5 --sk-password "<store_keeper_password>"`
- [ ] Confirm Scenario 1 now shows `1x 201 + 1x 400` consistently across all 5 iterations, no 500s
- [ ] Confirm Scenarios 2 and 3 still pass (no regression from touching shared request-creation code, if any is shared)
- [ ] Run full pytest-django suite — confirm no regressions
- [ ] Only after this passes cleanly: merge `fix/race-conditions-pre-deploy`

Do not merge this branch until Scenario 1 passes cleanly.
