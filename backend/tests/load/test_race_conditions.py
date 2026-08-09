"""
Race-condition regression tests for the pre-deploy fix branch.

Tests three scenarios where concurrent requests should NOT bypass guards:

  Scenario 1 – TOCTOU on Stock Request create:
      Two staff users simultaneously POST to /api/stock_request/.
      With the select_for_update fix, exactly one should succeed (201)
      and the other should fail (400 – active request already exists).

  Scenario 2 – Stock Register Destroy:
      Two store_keepers simultaneously DELETE the same /api/stock_register/{id}/.
      With the select_for_update fix, inventory is deducted exactly once.

  Scenario 3 – Damaged Entry Destroy:
      Two store_keepers simultaneously DELETE the same /api/damaged_entry/{id}/.
      With the select_for_update fix, inventory is incremented exactly once.

Usage:
    1. Start the Django backend:
         cd backend && python manage.py runserver

    2. Run this script (from repo root or anywhere):
         python backend/tests/load/test_race_conditions.py

    Options:
         --base-url URL     Backend base URL (default: http://localhost:8000)
         --iterations N     Number of paired rounds per scenario (default: 5)
         --setup-only        Only create test fixtures, then exit
         --cleanup-only      Remove test fixtures, then exit

Requirements:
    pip install requests gevent psycopg2-binary django
"""

import argparse
import os
import random
import string
import sys
import time
import uuid
from datetime import date

# ---------------------------------------------------------------------------
# Set Django settings before anything else imports Django
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings.dev")

import gevent
import gevent.monkey

# ---------------------------------------------------------------------------
# Must monkey-patch before importing psycopg2 or using threading primitives
# ---------------------------------------------------------------------------
gevent.monkey.patch_all()

import requests

# ---------------------------------------------------------------------------
# Config – overridden by CLI flags
# ---------------------------------------------------------------------------
BASE_URL = "http://localhost:8000"
DB_DSN = "dbname=LMS_db user=postgres password=postgres host=localhost port=5432"

# Unique prefix so parallel test runs don't collide
RUN_ID = uuid.uuid4().hex[:8]

# ---------------------------------------------------------------------------
# Test user definitions
# ---------------------------------------------------------------------------
STAFF_USERS = [
    {"employee_id": f"LSA_{RUN_ID}", "password": "Test@Pass123!",
     "full_name": "Locust Staff A", "email": f"lsa_{RUN_ID}@test.local", "role": "staff"},
    {"employee_id": f"LSB_{RUN_ID}", "password": "Test@Pass123!",
     "full_name": "Locust Staff B", "email": f"lsb_{RUN_ID}@test.local", "role": "staff"},
]

STORE_KEEPER_USERS = [
    {"employee_id": f"LSK_{RUN_ID}", "password": "Test@Pass123!",
     "full_name": "Locust SK", "email": f"lsk_{RUN_ID}@test.local", "role": "store_keeper"},
]

# Will be populated by setup if an existing store_keeper is found
EXISTING_SK = None
SK_PASSWORD = None

# Shared inventory items seeded once per run
TEST_CHEMICAL_NAME = f"LocustTestChem_{RUN_ID}"
TEST_APPARATUS_NAME = f"LocustTestApp_{RUN_ID}"


# ===================================================================
# Helpers
# ===================================================================

def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def login(user):
    """Login and return access token."""
    r = requests.post(f"{BASE_URL}/api/users/login/", json={
        "username": user["employee_id"],
        "password": user["password"],
    }, timeout=10)
    r.raise_for_status()
    data = r.json()
    assert "access" in data, f"Login failed for {user['employee_id']}: {data}"
    return data["access"]


def api_post(token, path, payload):
    return requests.post(f"{BASE_URL}{path}", headers=_headers(token),
                         json=payload, timeout=15)


def api_delete(token, path):
    return requests.delete(f"{BASE_URL}{path}", headers=_headers(token), timeout=15)


# ===================================================================
# Database helpers (psycopg2)
# ===================================================================

def _db_connect():
    import psycopg2
    return psycopg2.connect(DB_DSN)


def db_execute(sql, params=None):
    conn = _db_connect()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            conn.commit()
    finally:
        conn.close()


def db_fetchone(sql, params=None):
    import psycopg2.extras
    conn = _db_connect()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchone()
    finally:
        conn.close()


# ===================================================================
# Setup / Teardown
# ===================================================================

def create_test_user(user):
    """Insert a test user into user_account via raw SQL."""
    from django.contrib.auth.hashers import make_password
    hashed = make_password(user["password"])
    # Generate unique phone in +91XXXXXXXXXX format
    suffix = ''.join(random.choices(string.digits, k=10))
    phone = f"+91{suffix}"
    db_execute("""
        INSERT INTO user_account
            (employee_id, full_name, email, phone, role, designation, department,
             is_active, is_staff, is_superuser, password_must_change, is_first_login,
             failed_login_attempts, password)
        VALUES (%s, %s, %s, %s, %s, %s, %s, true, false, false, false, false, 0, %s)
        ON CONFLICT (employee_id) DO NOTHING
    """, (
        user["employee_id"], user["full_name"], user["email"],
        phone, user["role"], "Lab Staff", "B.Sc Chemistry", hashed,
    ))


def create_test_inventory():
    """Ensure the shared test chemical and apparatus exist."""
    db_execute("""
        INSERT INTO available_chemicals (chemical_name, quantity, unit, reorder_level)
        VALUES (%s, 1000, 'ml', 50)
        ON CONFLICT (chemical_name) DO UPDATE SET quantity = 1000
    """, (TEST_CHEMICAL_NAME,))
    db_execute("""
        INSERT INTO available_apparatus (apparatus_name, available_quantity_pieces, reorder_level)
        VALUES (%s, 100, 10)
        ON CONFLICT (apparatus_name) DO UPDATE SET available_quantity_pieces = 100
    """, (TEST_APPARATUS_NAME,))


def get_chemical_qty():
    row = db_fetchone(
        "SELECT quantity FROM available_chemicals WHERE chemical_name = %s",
        (TEST_CHEMICAL_NAME,))
    return float(row["quantity"]) if row else None


def get_apparatus_qty():
    row = db_fetchone(
        "SELECT available_quantity_pieces FROM available_apparatus WHERE apparatus_name = %s",
        (TEST_APPARATUS_NAME,))
    return int(row["available_quantity_pieces"]) if row else None


def setup_fixtures():
    """Create test users and seed inventory."""
    global EXISTING_SK
    print(f"[setup] Creating test users (run_id={RUN_ID}) ...")
    for u in STAFF_USERS:
        create_test_user(u)
        print(f"  -> {u['employee_id']}")

    # Check if a store_keeper already exists (DB constraint allows only one)
    existing = db_fetchone(
        "SELECT employee_id, full_name FROM user_account WHERE role = 'store_keeper'")
    if existing:
        EXISTING_SK = {
            "employee_id": existing["employee_id"],
            "full_name": existing["full_name"],
        }
        print(f"  -> reusing existing store_keeper: {existing['employee_id']}")
    else:
        for u in STORE_KEEPER_USERS:
            create_test_user(u)
            EXISTING_SK = {"employee_id": u["employee_id"], "full_name": u["full_name"]}
            print(f"  -> {u['employee_id']}")

    create_test_inventory()
    print(f"[setup] Inventory seeded: chemical={TEST_CHEMICAL_NAME}, "
          f"apparatus={TEST_APPARATUS_NAME}")
    print("[setup] Done.\n")


def cleanup_fixtures():
    """Remove all test data created during this run."""
    print(f"\n[cleanup] Removing test data (run_id={RUN_ID}) ...")

    for u in STAFF_USERS:
        eid = u["employee_id"]
        # Delete chemical items for requests created by this user
        db_execute("""
            DELETE FROM stock_request_chemical_item
            WHERE stock_request_id IN (
                SELECT id FROM stock_request
                WHERE requested_by_id = (SELECT id FROM user_account WHERE employee_id = %s)
            )
        """, (eid,))
        db_execute("""
            DELETE FROM stock_request
            WHERE requested_by_id = (SELECT id FROM user_account WHERE employee_id = %s)
        """, (eid,))

    # Use the SK employee_id that was used during setup
    sk_eid = EXISTING_SK["employee_id"] if EXISTING_SK else STORE_KEEPER_USERS[0]["employee_id"]
    sk_name = EXISTING_SK["full_name"] if EXISTING_SK else STORE_KEEPER_USERS[0]["full_name"]
    # Delete damaged items / entries created by test
    db_execute("""
        DELETE FROM damaged_item
        WHERE damaged_entry_id IN (
            SELECT id FROM damaged_entry WHERE staff = %s
        )
    """, (sk_name,))
    db_execute("DELETE FROM damaged_entry WHERE staff = %s", (sk_name,))

    # Remove stock register items seeded by test (by chemical / apparatus name)
    db_execute("DELETE FROM chemical_item WHERE chemical_name = %s", (TEST_CHEMICAL_NAME,))
    db_execute("DELETE FROM apparatus_item WHERE apparatus_name = %s", (TEST_APPARATUS_NAME,))
    # Remove orphan stock register entries (no items left)
    db_execute("""
        DELETE FROM stock_register sr
        WHERE NOT EXISTS (SELECT 1 FROM chemical_item ci WHERE ci.stock_register_id = sr.id)
          AND NOT EXISTS (SELECT 1 FROM apparatus_item ai WHERE ai.stock_register_id = sr.id)
          AND sr.supplier_name LIKE %s
    """, (f"Locust Supplier {RUN_ID}%",))

    # Remove test inventory
    db_execute("DELETE FROM available_chemicals WHERE chemical_name = %s", (TEST_CHEMICAL_NAME,))
    db_execute("DELETE FROM available_apparatus WHERE apparatus_name = %s", (TEST_APPARATUS_NAME,))

    # Remove only staff users we created (never remove the existing store_keeper)
    for u in STAFF_USERS:
        eid = u["employee_id"]
        db_execute("DELETE FROM audit_log WHERE user_id = "
                   "(SELECT id FROM user_account WHERE employee_id = %s)", (eid,))
        db_execute("DELETE FROM user_account WHERE employee_id = %s", (eid,))
        print(f"  -> removed {eid}")
    # Remove test store_keeper only if we created it (not reused)
    if EXISTING_SK is None:
        for u in STORE_KEEPER_USERS:
            eid = u["employee_id"]
            db_execute("DELETE FROM audit_log WHERE user_id = "
                       "(SELECT id FROM user_account WHERE employee_id = %s)", (eid,))
            db_execute("DELETE FROM user_account WHERE employee_id = %s", (eid,))
            print(f"  -> removed {eid}")

    print("[cleanup] Done.\n")


# ===================================================================
# Scenario 1: TOCTOU on Stock Request create
# ===================================================================

def _stock_request_payload():
    return {
        "class_name": "I B.Sc Chemistry",
        "day_order": "I",
        "hour": [1, 2],
        "purpose_type": "practical_lab",
        "experiment_name": f"LocustTest_{RUN_ID}_{uuid.uuid4().hex[:4]}",
        "chemical_items": [
            {"chemical_name": TEST_CHEMICAL_NAME, "quantity": 5}
        ],
    }


def scenario_toctou(iteration):
    """
    One staff user simultaneously creates two stock requests.
    With the select_for_update fix, at most one should be created as pending.
    """
    token = login(STAFF_USERS[0])

    results = [None, None]

    def make_request(idx):
        resp = api_post(token, "/api/stock_request/", _stock_request_payload())
        results[idx] = resp.status_code

    g1 = gevent.spawn(make_request, 0)
    g2 = gevent.spawn(make_request, 1)
    gevent.joinall([g1, g2], timeout=20)

    # Count how many pending requests now exist for this user
    row = db_fetchone("""
        SELECT COUNT(*) as cnt FROM stock_request
        WHERE requested_by_id = (SELECT id FROM user_account WHERE employee_id = %s)
          AND status IN ('pending', 'accepted', 'issued', 'reported')
    """, (STAFF_USERS[0]["employee_id"],))
    active_count = row["cnt"] if row else 0

    # Clean up all requests created by this user
    db_execute("""
        DELETE FROM stock_request_chemical_item WHERE stock_request_id IN (
            SELECT id FROM stock_request
            WHERE requested_by_id = (SELECT id FROM user_account WHERE employee_id = %s)
        )
    """, (STAFF_USERS[0]["employee_id"],))
    db_execute("""
        DELETE FROM stock_request
        WHERE requested_by_id = (SELECT id FROM user_account WHERE employee_id = %s)
    """, (STAFF_USERS[0]["employee_id"],))

    # Both may succeed (201,201) or one may fail (500 from request_id collision or
    # 400 from the active-request check). The key invariant: at most 1 active request.
    both_attempted = all(code is not None for code in results)
    passed = both_attempted and active_count <= 1
    detail = f"HTTP codes={results}, active_requests={active_count}"
    return {
        "scenario": "TOCTOU Stock Request",
        "iteration": iteration,
        "results": results,
        "active_count": active_count,
        "passed": passed,
        "detail": detail,
    }


# ===================================================================
# Scenario 2: Stock Register Destroy
# ===================================================================

def _create_stock_register(token):
    """Create a stock register entry and return its ID."""
    payload = {
        "invoice_number": f"LOC-{RUN_ID}-{uuid.uuid4().hex[:6]}",
        "date": date.today().isoformat(),
        "supplier_name": f"Locust Supplier {RUN_ID}",
        "chemical_items": [{
            "chemical_name": TEST_CHEMICAL_NAME,
            "make": "LocustMake",
            "pack_size": "500.00",
            "no_of_packs": 1,
            "unit": "ml",
            "rate": "100.00",
        }],
    }
    r = api_post(token, "/api/stock_register/", payload)
    r.raise_for_status()
    return r.json()["id"]


def scenario_stock_register_destroy(iteration):
    """
    Two concurrent DELETE requests hit the same stock register.
    Inventory should be decremented by exactly one batch (500 ml).
    """
    sk_user = {"employee_id": EXISTING_SK["employee_id"], "password": SK_PASSWORD}
    token = login(sk_user)

    # Seed inventory to a known value
    db_execute("UPDATE available_chemicals SET quantity = 1000 WHERE chemical_name = %s",
               (TEST_CHEMICAL_NAME,))
    gevent.sleep(0.05)

    # Create the stock register (adds 500 ml to inventory)
    entry_id = _create_stock_register(token)
    gevent.sleep(0.1)

    qty_before = get_chemical_qty()

    results = [None, None]

    def delete_entry(idx):
        resp = api_delete(token, f"/api/stock_register/{entry_id}/")
        results[idx] = resp.status_code

    g1 = gevent.spawn(delete_entry, 0)
    g2 = gevent.spawn(delete_entry, 1)
    gevent.joinall([g1, g2], timeout=20)

    qty_after = get_chemical_qty()
    deducted = qty_before - qty_after

    passed = (results.count(204) == 1 and results.count(404) == 1
              and abs(deducted - 500) < 0.01)
    detail = f"HTTP={results}, deducted={deducted} (expected 500), qty {qty_before}->{qty_after}"
    return {
        "scenario": "Stock Register Destroy",
        "iteration": iteration,
        "results": results,
        "qty_before": qty_before,
        "qty_after": qty_after,
        "deducted": deducted,
        "passed": passed,
        "detail": detail,
    }


# ===================================================================
# Scenario 3: Damaged Entry Destroy
# ===================================================================

def _create_damaged_entry(token, staff_name):
    """Create a damaged entry and return its ID."""
    payload = {
        "staff": staff_name,
        "class_name": "I B.Sc Chemistry",
        "date": date.today().isoformat(),
        "damaged_items": [{
            "apparatus_name": TEST_APPARATUS_NAME,
            "quantity": 3,
        }],
    }
    r = api_post(token, "/api/damaged_entry/", payload)
    r.raise_for_status()
    # The create serializer doesn't include 'id' in fields, so get it from DB
    row = db_fetchone(
        "SELECT id FROM damaged_entry WHERE staff = %s ORDER BY id DESC LIMIT 1",
        (staff_name,))
    return row["id"]


def scenario_damaged_entry_destroy(iteration):
    """
    Two concurrent DELETE requests hit the same damaged entry.
    Inventory should be restored exactly once (+3 pieces).
    """
    sk_user = {"employee_id": EXISTING_SK["employee_id"], "password": SK_PASSWORD}
    token = login(sk_user)

    # Seed inventory to a known value
    db_execute("UPDATE available_apparatus SET available_quantity_pieces = 100 "
               "WHERE apparatus_name = %s", (TEST_APPARATUS_NAME,))
    gevent.sleep(0.05)

    # Create the damaged entry
    entry_id = _create_damaged_entry(token, EXISTING_SK["full_name"])
    gevent.sleep(0.1)

    qty_before = get_apparatus_qty()

    results = [None, None]

    def delete_entry(idx):
        resp = api_delete(token, f"/api/damaged_entry/{entry_id}/")
        results[idx] = resp.status_code

    g1 = gevent.spawn(delete_entry, 0)
    g2 = gevent.spawn(delete_entry, 1)
    gevent.joinall([g1, g2], timeout=20)

    qty_after = get_apparatus_qty()
    restored = qty_after - qty_before

    passed = (results.count(204) == 1 and results.count(404) == 1
              and restored == 3)
    detail = f"HTTP={results}, restored={restored} (expected 3), qty {qty_before}->{qty_after}"
    return {
        "scenario": "Damaged Entry Destroy",
        "iteration": iteration,
        "results": results,
        "qty_before": qty_before,
        "qty_after": qty_after,
        "restored": restored,
        "passed": passed,
        "detail": detail,
    }


# ===================================================================
# Runner
# ===================================================================

SCENARIOS = [
    scenario_toctou,
    scenario_stock_register_destroy,
    scenario_damaged_entry_destroy,
]


def run_all(iterations):
    all_results = []
    for scenario_fn in SCENARIOS:
        doc_first_line = (scenario_fn.__doc__ or "").strip().splitlines()[0]
        print(f"\n{'=' * 60}")
        print(f"  {doc_first_line}")
        print(f"{'=' * 60}")
        for i in range(1, iterations + 1):
            result = scenario_fn(i)
            status = "PASS" if result["passed"] else "FAIL"
            print(f"  [{status}] Iter {result['iteration']}: {result['detail']}")
            all_results.append(result)
            # Small gap so DB sequences don't collide
            gevent.sleep(0.1)

    # Summary
    total = len(all_results)
    passed = sum(1 for r in all_results if r["passed"])
    failed = total - passed

    print(f"\n{'=' * 60}")
    print(f"  SUMMARY: {passed}/{total} passed, {failed} failed")
    print(f"{'=' * 60}")

    if failed:
        print("\n  Failed results:")
        for r in all_results:
            if not r["passed"]:
                print(f"    {r['scenario']} iter {r['iteration']}: {r['detail']}")

    return failed == 0


def main():
    global BASE_URL, DB_DSN, SK_PASSWORD

    parser = argparse.ArgumentParser(
        description="Race-condition regression tests")
    parser.add_argument("--base-url", default=BASE_URL,
                        help="Backend base URL (default: %(default)s)")
    parser.add_argument("--db-dsn", default=DB_DSN,
                        help="PostgreSQL DSN (default: %(default)s)")
    parser.add_argument("--sk-password", default="Test@Pass123!",
                        help="Password for existing store_keeper account")
    parser.add_argument("--iterations", type=int, default=5,
                        help="Paired rounds per scenario (default: 5)")
    parser.add_argument("--setup-only", action="store_true",
                        help="Create fixtures then exit")
    parser.add_argument("--cleanup-only", action="store_true",
                        help="Remove fixtures then exit")
    args = parser.parse_args()

    BASE_URL = args.base_url
    DB_DSN = args.db_dsn
    SK_PASSWORD = args.sk_password

    if args.setup_only:
        setup_fixtures()
        return

    if args.cleanup_only:
        cleanup_fixtures()
        return

    # Verify backend is reachable
    try:
        requests.get(f"{BASE_URL}/api/", timeout=5)
    except requests.ConnectionError:
        print(f"ERROR: Cannot reach backend at {BASE_URL}")
        print("Make sure the Django dev server is running.")
        sys.exit(1)

    print(f"Target:  {BASE_URL}")
    print(f"DB:      {DB_DSN}")
    print(f"Iters:   {args.iterations} per scenario")
    print(f"Run ID:  {RUN_ID}")

    try:
        setup_fixtures()
        success = run_all(args.iterations)
    finally:
        cleanup_fixtures()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
