## Process Note: Raw SQL Schema Changes Must Be Applied in 3 Places

**Context:** This project uses `managed=False` on all models — Django does not auto-apply schema changes. Every schema change is a manually-run SQL statement. This is intentional (prevents AI agents/tools from silently drifting the schema), but it means schema changes do NOT propagate automatically anywhere.

**What was learned (August 2026):** A new column (`committed_quantity_ml`) was added to a teammate's local working database, and the model code was updated to match. This caused 14 false test failures on a different teammate's machine — not because of a bug, but because the column existed in one person's real working database while the *test* database (a separate, hidden database Django auto-creates for running tests) still had the old schema.

**The rule going forward:** Any raw SQL schema change (`ALTER TABLE`, `CREATE TABLE`, etc.) must be manually applied in all of the following places before the corresponding code change is considered "done":

1. **Your own real/working local database** — the one your app actually runs against day to day.
2. **Your own local test database** — the separate database Django creates when you run `manage.py test`. This is NOT the same database as #1, even though it's easy to assume it is. If tests suddenly fail with "column does not exist" errors after a schema change, this is the first thing to check.
3. **Communicated to every teammate** — each teammate maintains their own separate local database (not shared), so the same SQL must be manually re-run by each person on both their real and test databases.

**Practical tip:** the fastest way to sync a test database after a schema change is to dump the schema (not data) from the real database and restore it into the test database, keeping the `django_migrations` table/ledger intact so Django doesn't attempt to re-migrate a `managed=False` project.

**Where this should live:** Add this note to `KNOWN_ISSUES.md` or `DECISIONS.md` in the repo, and reference it in `SESSION_PROMPT.md` so any future schema-change prompt reminds the agent (and the person running it) to check all 3 locations.
