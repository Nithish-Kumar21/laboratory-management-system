"""
Shared fixtures for Playwright E2E tests.
Handles: browser context, API-based auth/seed, database cleanup.
"""
import os
import time
import pytest
import requests
from datetime import date, timedelta
from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")
API_URL = os.getenv("E2E_API_URL", "http://localhost:8000/api")


# ---------------------------------------------------------------------------
# Override root conftest autouse fixtures that require Django DB.
# E2E tests communicate with the live backend via HTTP — no local DB needed.
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _django_db_helper():
    """No-op: E2E tests do not need Django's test DB transaction wrapper."""
    yield


@pytest.fixture(autouse=True)
def _ensure_venue_column():
    """No-op: schema concerns are the live DB's responsibility."""
    pass


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    """Clear the server-side throttle cache via API between tests."""
    import requests as _req
    try:
        # Hit a dummy endpoint to reset IP-based throttle tracking
        # Use the Django management command to flush cache
        import subprocess, sys
        subprocess.run(
            [sys.executable, "manage.py", "clear_cache", "--settings=backend.settings.dev"],
            capture_output=True, timeout=10,
            cwd=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backend"),
        )
    except Exception:
        pass


@pytest.fixture(autouse=True, scope="function")
def _unlock_test_users():
    """Reset failed login attempts and account lockouts before each test."""
    import requests as _req
    try:
        # Direct DB reset via a lightweight script-like call
        import subprocess, sys
        subprocess.run(
            [sys.executable, "-c", """
import os; os.environ['DJANGO_SETTINGS_MODULE']='backend.settings_test'
import sys; sys.path.insert(0,'backend'); import django; django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
for u in User.objects.filter(employee_id__in=['test_hod','test_store_keeper','test_staff','staff_test','admin_test']):
    u.failed_login_attempts = 0; u.account_locked_until = None; u.save()
"""],
            capture_output=True, timeout=10,
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        )
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Browser-level fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def browser_instance():
    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
    yield browser
    browser.close()
    pw.stop()


@pytest.fixture(scope="function")
def context(browser_instance: Browser) -> BrowserContext:
    ctx = browser_instance.new_context(
        viewport={"width": 1280, "height": 800},
        locale="en-US",
        timezone_id="Asia/Kolkata",
    )
    yield ctx
    ctx.close()


@pytest.fixture(scope="function")
def page(context: BrowserContext) -> Page:
    p = context.new_page()
    p.set_default_timeout(15000)
    yield p
    p.close()


# ---------------------------------------------------------------------------
# API helpers — seed data via REST, bypassing UI for speed & reliability
# ---------------------------------------------------------------------------

class APIClient:
    """Thin wrapper around requests for talking to the Django REST backend."""

    def __init__(self, base_url: str = API_URL):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.access_token = None
        self.refresh_token = None

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self.access_token:
            h["Authorization"] = f"Bearer {self.access_token}"
        return h

    def login(self, employee_id: str, password: str) -> dict:
        import time as _time
        for _attempt in range(3):
            r = self.session.post(
                f"{self.base_url}/users/login/",
                json={"username": employee_id, "password": password},
                headers={"Content-Type": "application/json"},
            )
            if r.status_code == 429:
                _time.sleep(10)
                continue
            r.raise_for_status()
            break
        data = r.json()
        if "access" in data:
            self.access_token = data["access"]
            self.refresh_token = data["refresh"]
        return data

    def get(self, path, **kw):
        return self.session.get(f"{self.base_url}/{path.lstrip('/')}", headers=self._headers(), **kw)

    def post(self, path, **kw):
        return self.session.post(f"{self.base_url}/{path.lstrip('/')}", headers=self._headers(), **kw)

    def put(self, path, **kw):
        return self.session.put(f"{self.base_url}/{path.lstrip('/')}", headers=self._headers(), **kw)

    def patch(self, path, **kw):
        return self.session.patch(f"{self.base_url}/{path.lstrip('/')}", headers=self._headers(), **kw)

    def delete(self, path, **kw):
        return self.session.delete(f"{self.base_url}/{path.lstrip('/')}", headers=self._headers(), **kw)


@pytest.fixture(scope="session")
def api():
    """Unauthenticated API client for setup operations."""
    return APIClient()


@pytest.fixture(scope="function")
def api_hod():
    """API client authenticated as HOD."""
    c = APIClient()
    c.login("test_hod", "test123")
    return c


@pytest.fixture(scope="function")
def api_sk():
    """API client authenticated as Store Keeper."""
    c = APIClient()
    c.login("test_store_keeper", "test123")
    return c


@pytest.fixture(scope="function")
def api_staff():
    """API client authenticated as Staff."""
    c = APIClient()
    c.login("staff_test", "test123")
    return c


@pytest.fixture(scope="function")
def api_admin():
    """API client authenticated as Admin."""
    c = APIClient()
    c.login("admin_test", "test123")
    return c


# ---------------------------------------------------------------------------
# UI auth helpers — login via Playwright page and store tokens
# ---------------------------------------------------------------------------

def ui_login(page: Page, employee_id: str, password: str, base_url: str = BASE_URL):
    """Perform login through the UI and wait for redirect."""
    page.goto(f"{base_url}/login")
    page.locator('input[aria-label="Employee ID"]').nth(1).fill(employee_id)
    page.locator('input[aria-label="Password"]').nth(1).fill(password)
    page.locator('button[type="submit"]').nth(1).click()
    # Wait for navigation away from login
    page.wait_for_function(
        "() => window.location.pathname !== '/login'",
        timeout=10000,
    )
    page.wait_for_load_state("networkidle")


def inject_auth(page: Page, access_token: str, refresh_token: str, user_data: dict):
    """Inject JWT tokens into localStorage to bypass UI login."""
    import json as _json
    page.goto(f"{BASE_URL}/login")
    user_json = _json.dumps(user_data)
    page.evaluate("""([at, rt, ud]) => {
        localStorage.setItem('access_token', at);
        localStorage.setItem('refresh_token', rt);
        localStorage.setItem('user', ud);
    }""", [access_token, refresh_token, user_json])


@pytest.fixture
def login_hod(page: Page, api_hod):
    """Login as HOD via UI and return the page."""
    user_data = api_hod.get("users/me/").json()
    inject_auth(page, api_hod.access_token, api_hod.refresh_token, user_data)
    return page


@pytest.fixture
def login_sk(page: Page, api_sk):
    """Login as Store Keeper via UI."""
    user_data = api_sk.get("users/me/").json()
    inject_auth(page, api_sk.access_token, api_sk.refresh_token, user_data)
    return page


@pytest.fixture
def login_staff(page: Page, api_staff):
    """Login as Staff via UI."""
    user_data = api_staff.get("users/me/").json()
    inject_auth(page, api_staff.access_token, api_staff.refresh_token, user_data)
    return page


@pytest.fixture
def login_admin(page: Page, api_admin):
    """Login as Admin via UI."""
    user_data = api_admin.get("users/me/").json()
    inject_auth(page, api_admin.access_token, api_admin.refresh_token, user_data)
    return page


# ---------------------------------------------------------------------------
# Data seeding helpers
# ---------------------------------------------------------------------------

def seed_chemical(api_client: APIClient, name: str, qty: float = 500.0, reorder: float = 50.0, unit: str = "ml"):
    """Ensure a chemical exists in inventory by creating a stock register entry."""
    # First check if it already exists
    existing = api_client.get(f"available_chemicals/?search={name}")
    if existing.ok:
        results = existing.json()
        if isinstance(results, list):
            for item in results:
                if item.get("chemical_name", "").lower() == name.lower():
                    return item.get("id")
        elif isinstance(results, dict) and "results" in results:
            for item in results["results"]:
                if item.get("chemical_name", "").lower() == name.lower():
                    return item.get("id")

    invoice = f"INV-SEED-{int(time.time())}"
    payload = {
        "invoice_number": invoice,
        "date": date.today().isoformat(),
        "supplier_name": "Seed Supplier",
        "supplier_contact_country_code": "+91",
        "supplier_contact_phone": "9999999999",
        "chemical_items": [
            {
                "chemical_name": name,
                "pack_size": str(qty),
                "no_of_packs": 1,
                "unit": unit,
                "rate": "100.00",
                "make": "Seed Make",
                "reorder_level": str(reorder),
            }
        ],
        "apparatus_items": [],
    }
    r = api_client.post("stock_register/", json=payload)
    if r.status_code == 201:
        return r.json().get("id")
    return None


def seed_apparatus(api_client: APIClient, name: str, qty: int = 50, reorder: int = 10):
    """Ensure apparatus exists in inventory via stock register entry."""
    invoice = f"INV-SEED-APP-{int(time.time())}"
    payload = {
        "invoice_number": invoice,
        "date": date.today().isoformat(),
        "supplier_name": "Seed Supplier",
        "supplier_contact_country_code": "+91",
        "supplier_contact_phone": "9999999999",
        "chemical_items": [],
        "apparatus_items": [
            {
                "apparatus_name": name,
                "quantity_pieces": qty,
                "rate": "50.00",
                "make": "Seed Make",
                "reorder_level": reorder,
            }
        ],
    }
    r = api_client.post("stock_register/", json=payload)
    if r.status_code == 201:
        return r.json().get("id")
    return None


def create_stock_request(api_client: APIClient, **kwargs):
    """Create a stock request directly via API."""
    today = date.today().isoformat()
    payload = {
        "class_name": kwargs.get("class_name", "I B.Sc Chemistry"),
        "date": kwargs.get("date", today),
        "day_order": kwargs.get("day_order", "I"),
        "hour": kwargs.get("hour", [1]),
        "purpose_type": kwargs.get("purpose_type", "practical_lab"),
        "experiment_name": kwargs.get("experiment_name", "E2E Test Experiment"),
        "venue": kwargs.get("venue", "B.Sc Chemistry Laboratory"),
        "chemical_items": kwargs.get("chemical_items", []),
        "apparatus_items": kwargs.get("apparatus_items", []),
    }
    if "status" in kwargs:
        payload["status"] = kwargs["status"]
    if "reason" in kwargs:
        payload["reason"] = kwargs["reason"]
    r = api_client.post("stock_request/", json=payload)
    return r


# ---------------------------------------------------------------------------
# Cleanup / teardown helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def today_str():
    return date.today().isoformat()


@pytest.fixture
def tomorrow_str():
    return (date.today() + timedelta(days=1)).isoformat()


@pytest.fixture
def yesterday_str():
    return (date.today() - timedelta(days=1)).isoformat()
