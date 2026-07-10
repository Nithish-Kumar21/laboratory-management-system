# Race Condition Load Tests

Standalone gevent-based test script that verifies the three `select_for_update()` race-condition fixes from `fix/race-conditions-pre-deploy`.

## Prerequisites

```bash
pip install requests gevent psycopg2-binary django
```

The Django backend must be running:

```bash
cd backend
python manage.py runserver
```

## Running

```bash
# From the repo root:
python backend/tests/load/test_race_conditions.py

# Or with options:
python backend/tests/load/test_race_conditions.py --iterations 10 --base-url http://localhost:8000
```

| Flag | Default | Purpose |
|---|---|---|
| `--base-url` | `http://localhost:8000` | Backend URL |
| `--db-dsn` | `dbname=LMS_db user=postgres password=postgres host=localhost port=5432` | PostgreSQL DSN |
| `--iterations` | `5` | Paired rounds per scenario |
| `--setup-only` | — | Create test fixtures then exit |
| `--cleanup-only` | — | Remove test fixtures then exit |

## What is tested

### Scenario 1 — TOCTOU Stock Request Create
Two staff users simultaneously `POST /api/stock_request/`. Without the fix both requests could pass the "no active request" check. With `select_for_update()` locking active rows, exactly **one succeeds (201)** and **one fails (400)**.

### Scenario 2 — Stock Register Destroy
Two store_keepers simultaneously `DELETE /api/stock_register/{id}/`. Without the fix both reads of `AvailableChemical.quantity` could return the same value, causing a double deduction. With the fix, inventory is decremented **exactly once (500 ml)**.

### Scenario 3 — Damaged Entry Destroy
Two store_keepers simultaneously `DELETE /api/damaged_entry/{id}/`. Without the fix both reads of `AvailableApparatus.available_quantity_pieces` could return the same value, causing a double increment. With the fix, inventory is incremented **exactly once (+3 pieces)**.

## Cleanup

Test fixtures (users, inventory, request/register/entry rows) are cleaned up automatically after each run. If the script is interrupted, re-run with `--cleanup-only`.
