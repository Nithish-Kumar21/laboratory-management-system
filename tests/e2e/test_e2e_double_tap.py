"""
Scenario 7 – End-to-end UI double-tap (real browser).

Automate a real browser session: click action buttons twice in rapid
succession. The frontend disables buttons after first click via actionLoading
state, but React re-render is not instant. A fast double-click can send
two API calls before the DOM updates.

Assert: UI reflects single operation completed; verify against DB after.

Requirements:
  - Django backend running at http://localhost:8000
  - Frontend running at http://localhost:3000
"""
import time
import uuid
from decimal import Decimal

import psycopg2
import psycopg2.extras
import pytest
import requests as req_lib
from playwright.sync_api import sync_playwright

FRONTEND_URL = "http://localhost:3000"
BACKEND_API = "http://localhost:8000/api"
PROD_DB = dict(dbname="LMS_db", user="postgres", password="postgres",
               host="localhost", port=5432)

HOD_EID = "test_hod"
HOD_PWD = "test123"
SK_EID = "test_store_keeper"
SK_PWD = "Test@1234"
NEW_USER_PWD = "TestPass123!"
NEW_USER_PWD2 = "TestPass1234!"


def _db():
    return psycopg2.connect(**PROD_DB)


def _unique_eid(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _api_login(eid, password=NEW_USER_PWD):
    r = req_lib.post(f"{BACKEND_API}/users/login/", json={
        "username": eid, "password": password,
    })
    return r


def _get_token(eid, password=NEW_USER_PWD):
    r = _api_login(eid, password)
    assert r.status_code == 200, f"Login failed for {eid}: {r.status_code} {r.text[:200]}"
    data = r.json()
    if data.get("first_login"):
        temp_token = data["temp_token"]
        r2 = req_lib.post(f"{BACKEND_API}/users/change-password/", json={
            "new_password": NEW_USER_PWD2,
            "confirm_password": NEW_USER_PWD2,
        }, headers={"Authorization": f"Bearer {temp_token}"})
        assert r2.status_code in (200, 201), f"Change pw failed: {r2.text[:200]}"
        r3 = _api_login(eid, NEW_USER_PWD2)
        assert r3.status_code == 200, f"Re-login failed: {r3.text[:200]}"
        return r3.json()["access"]
    return data["access"]


def _create_user_via_api(hod_token, role="staff"):
    eid = _unique_eid(f"e2e{role[:3]}")
    r = req_lib.post(f"{BACKEND_API}/users/", json={
        "employee_id": eid,
        "email": f"{eid}@test.local",
        "password": "TestPass123!",
        "role": role,
        "full_name": f"E2E {role}",
        "phone": f"+91999{hash(eid) % 10000000:07d}",
        "designation": role.replace("_", " ").title(),
        "department": "B.Sc Chemistry",
    }, headers={"Authorization": f"Bearer {hod_token}"})
    assert r.status_code in (200, 201), f"Create {role} failed: {r.text}"
    return eid


def _create_chemical_via_api(chem_name):
    conn = _db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO available_chemicals (chemical_name, quantity, unit, reorder_level)
        VALUES (%s, 1000.00, 'ml', 50.00)
        ON CONFLICT (chemical_name) DO UPDATE SET quantity = EXCLUDED.quantity
    """, (chem_name,))
    conn.commit()
    conn.close()


def _create_draft(token, chem_name):
    r = req_lib.post(f"{BACKEND_API}/stock_request/", json={
        "class_name": "I B.Sc Chemistry",
        "day_order": "I",
        "hour": [1, 2],
        "venue": "B.Sc Chemistry Laboratory",
        "purpose_type": "practical_lab",
        "status": "draft",
        "experiment_name": f"E2E_{uuid.uuid4().hex[:6]}",
        "chemical_items": [{"chemical_name": chem_name, "quantity": "200.00"}],
    }, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code in (200, 201), f"Create draft failed: {r.text}"
    return r.json()["id"]


def _api_action(token, req_id, action, data=None):
    url = f"{BACKEND_API}/stock_request/{req_id}/{action}/"
    r = req_lib.post(url, json=data,
                     headers={"Authorization": f"Bearer {token}"})
    assert r.status_code in (200, 201), f"{action} failed ({r.status_code}): {r.text}"
    return r.json()


def _get_chemical_item_ids(req_id):
    """Get chemical_item IDs for a request from production DB."""
    conn = _db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM stock_request_chemical_item WHERE stock_request_id=%s", (req_id,))
    ids = [row[0] for row in cur.fetchall()]
    conn.close()
    return ids


def _login_via_ui(page, employee_id, password=NEW_USER_PWD2):
    page.goto(f"{FRONTEND_URL}/login")
    page.wait_for_load_state("networkidle")
    page.get_by_role("textbox", name="Employee ID").fill(employee_id)
    page.get_by_role("textbox", name="Password").fill(password)
    page.get_by_role("button", name="Log In").click()
    page.wait_for_function(
        "window.location.pathname !== '/login'", timeout=15000,
    )


def _db_query_chemical(chem_name):
    conn = _db()
    cur = conn.cursor()
    cur.execute("SELECT quantity FROM available_chemicals WHERE chemical_name=%s",
                (chem_name,))
    row = cur.fetchone()
    conn.close()
    return Decimal(str(row[0])) if row else None


def _db_query_issue_count(req_id):
    conn = _db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM issue_register WHERE stock_request_db_id=%s",
                (req_id,))
    count = cur.fetchone()[0]
    conn.close()
    return count


def _db_query_request_status(req_id):
    conn = _db()
    cur = conn.cursor()
    cur.execute("SELECT status FROM stock_request WHERE id=%s", (req_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


class TestUIDoubleTap:

    def test_double_click_mark_as_issued(self):
        """Double-click 'Mark as Issued' on accepted request using force=True."""
        chem_name = f"E2E_Issue_{uuid.uuid4().hex[:8]}"

        hod_token = _get_token(HOD_EID, HOD_PWD)
        sk_token = _get_token(SK_EID, SK_PWD)
        staff_eid = _create_user_via_api(hod_token, "staff")
        staff_token = _get_token(staff_eid)

        _create_chemical_via_api(chem_name)
        time.sleep(0.5)
        qty_before = _db_query_chemical(chem_name)
        assert qty_before is not None, f"Chemical {chem_name} not created"

        req_id = _create_draft(staff_token, chem_name)
        _api_action(staff_token, req_id, "submit")
        _api_action(hod_token, req_id, "accept")
        assert _db_query_request_status(req_id) == "accepted"

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 720})
            page = context.new_page()

            _login_via_ui(page, SK_EID, SK_PWD)
            page.goto(f"{FRONTEND_URL}/requests/{req_id}")
            page.wait_for_load_state("networkidle")

            issued_btn = page.locator("button.sd-btn-primary.sd-btn-full")
            issued_btn.wait_for(state="visible", timeout=15000)

            issued_btn.click(force=True)
            time.sleep(0.05)
            issued_btn.click(force=True)

            page.wait_for_timeout(3000)
            browser.close()

        status = _db_query_request_status(req_id)
        qty_after = _db_query_chemical(chem_name)
        deducted = qty_before - qty_after

        print(f"\n  [double_click_issue] status={status} deducted={deducted}")
        assert status == "issued", f"FAIL: status={status}"
        assert deducted == Decimal("200.00"), (
            f"FAIL: deducted {deducted} (expected 200.00). qty {qty_before}->{qty_after}"
        )

    def test_double_click_submit_draft(self):
        """Double-click 'Submit' then 'OK' on confirm dialog."""
        chem_name = f"E2E_Sub_{uuid.uuid4().hex[:8]}"

        hod_token = _get_token(HOD_EID, HOD_PWD)
        sk_token = _get_token(SK_EID, SK_PWD)
        staff_eid = _create_user_via_api(hod_token, "staff")
        staff_token = _get_token(staff_eid)

        _create_chemical_via_api(chem_name)
        time.sleep(0.5)

        req_id = _create_draft(staff_token, chem_name)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 720})
            page = context.new_page()

            _login_via_ui(page, staff_eid)
            page.goto(f"{FRONTEND_URL}/requests/{req_id}")
            page.wait_for_load_state("networkidle")

            all_buttons = page.locator("button").all()
            btn_texts = [b.inner_text() for b in all_buttons]
            print(f"  [debug] Submit test buttons: {btn_texts}")

            submit_btn = page.locator(".sd-actions button.sd-btn-primary")
            submit_btn.wait_for(state="visible", timeout=10000)
            submit_btn.click()

            ok_btn = page.locator(".confirm-dialog-btn.confirm")
            ok_btn.wait_for(state="visible", timeout=5000)
            ok_btn.click()
            time.sleep(0.05)
            try:
                ok_btn.click(timeout=1000, force=True)
            except Exception:
                pass

            page.wait_for_timeout(3000)
            browser.close()

        status = _db_query_request_status(req_id)
        print(f"\n  [double_click_submit] status={status}")
        assert status == "pending", f"FAIL: status={status} (expected pending)"

    def test_double_click_mark_as_completed(self):
        """Double-click 'Confirm & Adjust Inventory' on reported request."""
        chem_name = f"E2E_Cmp_{uuid.uuid4().hex[:8]}"

        hod_token = _get_token(HOD_EID, HOD_PWD)
        sk_token = _get_token(SK_EID, SK_PWD)
        staff_eid = _create_user_via_api(hod_token, "staff")
        staff_token = _get_token(staff_eid)

        _create_chemical_via_api(chem_name)
        time.sleep(0.5)

        req_id = _create_draft(staff_token, chem_name)
        _api_action(staff_token, req_id, "submit")
        _api_action(hod_token, req_id, "accept")
        _api_action(sk_token, req_id, "mark_as_issued")

        item_ids = _get_chemical_item_ids(req_id)
        assert len(item_ids) > 0, f"No chemical items for request {req_id}"

        _api_action(staff_token, req_id, "report_usage",
                    {"items": [{"id": item_ids[0], "actual_used_quantity": 100}]})

        status_before = _db_query_request_status(req_id)
        assert status_before == "reported", f"Precondition failed: status={status_before}"

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 720})
            page = context.new_page()

            _login_via_ui(page, SK_EID, SK_PWD)
            page.goto(f"{FRONTEND_URL}/requests/{req_id}")
            page.wait_for_load_state("networkidle")

            complete_btn = page.locator("button.sd-btn-primary.sd-btn-full")
            complete_btn.wait_for(state="visible", timeout=10000)

            complete_btn.click(force=True)
            time.sleep(0.05)
            complete_btn.click(force=True)

            page.wait_for_timeout(3000)
            browser.close()

        status = _db_query_request_status(req_id)
        print(f"\n  [double_click_complete] status={status}")
        assert status == "completed", f"FAIL: status={status}"
