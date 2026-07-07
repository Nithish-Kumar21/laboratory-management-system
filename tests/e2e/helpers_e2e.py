import os
import sys
import subprocess
import requests

BASE_API = "http://127.0.0.1:8000/api"
BASE_URL = "http://localhost:3000"

CREDENTIALS = {
    "staff":       {"username": "test_staff",         "password": "test@123"},
    "hod":         {"username": "test_hod",            "password": "test123"},
    "storekeeper": {"username": "test_store_keeper",  "password": "Test@1234"},
}

SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)


def get_token(role: str) -> str:
    r = requests.post(f"{BASE_API}/users/login/", json=CREDENTIALS[role])
    assert r.status_code == 200, f"Login failed for {role}: {r.text}"
    return r.json()["access"]


def auth_headers(role: str) -> dict:
    return {"Authorization": f"Bearer {get_token(role)}"}


async def login_as(page, role: str):
    await page.goto(f"{BASE_URL}/login")
    await page.get_by_role("textbox", name="Employee ID").fill(CREDENTIALS[role]["username"])
    await page.get_by_role("textbox", name="Password").fill(CREDENTIALS[role]["password"])
    await page.get_by_role("button", name="Log In").click()
    await page.wait_for_function(
        "window.location.pathname !== '/login'",
        timeout=10000,
    )


async def click_submit(page):
    """Submit a form by dispatching submit event (reliable on mobile viewport)."""
    await page.evaluate("""
        const form = document.querySelector('form');
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    """)


def cancel_active_requests(token):
    """Delete all active requests for a user via DB cleanup."""
    _run_db_cleanup()


def _run_db_cleanup():
    """Delete all stale requests via Django management command."""
    try:
        subprocess.run(
            [sys.executable, r"D:\laboratory-management-system\backend\manage.py", "e2e_cleanup"],
            capture_output=True, timeout=30
        )
    except Exception:
        pass
