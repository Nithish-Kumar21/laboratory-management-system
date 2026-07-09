"""
Playwright E2E tests for the Service module (Storekeeper + HOD flows).

Covers:
  - Storekeeper creates a service entry (happy path + validations)
  - Storekeeper actions line items (repaired / damaged partial actions)
  - Storekeeper explicitly completes an entry
  - Complete rejected when items still have remaining quantity
  - HOD read-only visibility

Requires:
  - Django backend running on http://localhost:8000
  - React frontend running on http://localhost:3000
  - Seeded test users: test_store_keeper / Test@1234, test_hod / test123
  - Real PostgreSQL (trigger behavior + select_for_update)
  - AvailableApparatus rows with sufficient stock in the test DB

Usage:
  pytest tests/e2e/test_e2e_service.py -v --headed
"""

import pytest
import pytest_asyncio
import requests
from playwright.async_api import async_playwright

from helpers_e2e import BASE_API, BASE_URL, login_as, get_token


# ── Override conftest's browser_context for headed + slow_mo ──

@pytest_asyncio.fixture
async def browser_context():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=300)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        yield context
        await browser.close()


# ── API helpers ──

def _get_apparatus(min_stock=10, min_count=2):
    """Return up to `min_count` apparatus names each with stock >= `min_stock`."""
    token = get_token("storekeeper")
    r = requests.get(
        f"{BASE_API}/available_apparatus/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, f"GET available_apparatus failed: {r.text}"
    data = r.json()
    apps = data if isinstance(data, list) else data.get("results", [])
    suitable = [
        a["apparatus_name"]
        for a in apps
        if a.get("available_quantity_pieces", 0) >= min_stock
    ]
    return suitable[:min_count]


def _create_service_entry(apparatus_items, token=None):
    """Create a service entry via API. Returns the entry dict (with id, items, etc.)."""
    if token is None:
        token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "service_person_name": "E2E Service Person",
        "contact_country_code": "+91",
        "contact_number": "9876543210",
        "email": "service@e2e.test",
        "deliver_by_date": "2026-07-20",
        "items": [
            {"apparatus_name": name, "quantity": qty}
            for name, qty in apparatus_items
        ],
    }
    r = requests.post(
        f"{BASE_API}/service-entries/", json=payload, headers=headers
    )
    assert r.status_code == 201, f"Create service entry failed: {r.text}"
    return r.json()


def _action_item(entry_id, item_id, action_type, quantity, token=None):
    """Log a repaired/damaged action on a service entry item via API."""
    if token is None:
        token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(
        f"{BASE_API}/service-entries/{entry_id}/action_item/?item_id={item_id}",
        json={"action_type": action_type, "quantity": quantity},
        headers=headers,
    )
    assert r.status_code == 200, f"Action {action_type} failed: {r.text}"
    return r.json()


# ── Test: Form renders correctly ──

async def test_service_entry_form_visible(async_page):
    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/new-service-entry")
    await async_page.wait_for_load_state("networkidle")

    # Card 1 — Service ID placeholder (disabled)
    svc_input = async_page.locator("input[value*='SVC-']")
    assert await svc_input.is_visible()
    assert await svc_input.is_disabled()

    # Card 1 — Date picker (interactive, pre-filled)
    date_input = async_page.locator("input[type='date']").first
    assert await date_input.is_visible()
    assert await date_input.is_enabled()

    # Card 1 — Store keeper name pre-filled (disabled)
    sk_input = async_page.locator("input[value*='Store Keeper']")
    assert await sk_input.is_visible()
    assert await sk_input.is_disabled()

    # Card 2 — Editable fields present
    assert await async_page.get_by_placeholder("Name of service person").is_visible()
    assert await async_page.get_by_placeholder("10-digit number").is_visible()
    assert await async_page.get_by_placeholder("service@example.com").is_visible()
    assert await async_page.get_by_placeholder("Search apparatus...").is_visible()
    assert await async_page.get_by_role("button", name="Send for Service").is_visible()


# ── Test: Create service entry — happy path ──

async def test_service_entry_create_happy_path(async_page):
    apps = _get_apparatus(min_stock=10, min_count=2)
    if len(apps) < 2:
        pytest.skip("Need at least 2 apparatus with stock >= 10")

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/new-service-entry")
    await async_page.wait_for_load_state("networkidle")

    # Fill Card 2 fields
    await async_page.get_by_placeholder("Name of service person").fill("E2E Happy Path")
    await async_page.get_by_placeholder("10-digit number").fill("9988776655")
    await async_page.get_by_placeholder("service@example.com").fill("happy@e2e.test")

    # Tentative Delivery Date (second type=date input)
    delivery_input = async_page.locator("input[type='date']").nth(1)
    await delivery_input.fill("2026-07-20")

    # Add first apparatus line
    app_input = async_page.locator("input[placeholder='Search apparatus...']").first
    await app_input.fill(apps[0])
    await async_page.wait_for_timeout(500)

    suggestion = async_page.locator(".nrf-suggestion-item").first
    if await suggestion.count() > 0:
        await suggestion.click()
        await async_page.wait_for_timeout(300)

    qty_input = async_page.locator("input[placeholder='Qty']").first
    await qty_input.fill("3")

    # Add second apparatus line
    await async_page.get_by_role("button", name="Add Line").click()
    await async_page.wait_for_timeout(300)

    app_input = async_page.locator("input[placeholder='Search apparatus...']").nth(1)
    await app_input.fill(apps[1])
    await async_page.wait_for_timeout(500)

    suggestion = async_page.locator(".nrf-suggestion-item").first
    if await suggestion.count() > 0:
        await suggestion.click()
        await async_page.wait_for_timeout(300)

    qty_input = async_page.locator("input[placeholder='Qty']").nth(1)
    await qty_input.fill("2")

    # Submit
    submit_btn = async_page.get_by_role("button", name="Send for Service")
    await submit_btn.scroll_into_view_if_needed()
    await submit_btn.click()
    await async_page.wait_for_timeout(3000)

    # Verify redirect to list or still on form (redirect can be async)
    try:
        await async_page.wait_for_url(f"{BASE_URL}/damaged-entry", timeout=8000)
    except Exception:
        pass

    # Verify via API
    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(
        f"{BASE_API}/service-entries/?ordering=-date", headers=headers
    )
    assert r.status_code == 200
    data = r.json()
    entries = data if isinstance(data, list) else data.get("results", [])
    match = [
        e for e in entries if e.get("service_person_name") == "E2E Happy Path"
    ]
    assert len(match) >= 1, f"Created entry not found in API response"
    entry = match[0]
    assert entry["status"] == "in_service"
    assert len(entry["items"]) == 2


# ── Test: Contact number validation (HTML5 pattern rejects < 10 digits) ──

async def test_service_entry_validation_contact(async_page):
    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/new-service-entry")
    await async_page.wait_for_load_state("networkidle")

    await async_page.get_by_placeholder("Name of service person").fill("E2E Validation Contact")

    # Enter fewer than 10 digits — the input has pattern="[0-9]{10}" + required
    await async_page.get_by_placeholder("10-digit number").fill("12345")

    # Submit
    submit_btn = async_page.get_by_role("button", name="Send for Service")
    await submit_btn.scroll_into_view_if_needed()
    await submit_btn.click()
    await async_page.wait_for_timeout(2000)

    # Should still be on the form (not redirected)
    assert "/new-service-entry" in async_page.url, (
        "Form submitted despite invalid contact number"
    )


# ── Test: Quantity exceeds available stock (server-side validation) ──

async def test_service_entry_validation_quantity(async_page):
    # Find an apparatus with modest stock to test the boundary
    apps = _get_apparatus(min_stock=1, min_count=1)
    if not apps:
        pytest.skip("No apparatus with stock >= 1")

    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_API}/available_apparatus/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    all_apps = data if isinstance(data, list) else data.get("results", [])
    target = next(a for a in all_apps if a["apparatus_name"] == apps[0])
    max_qty = int(target["available_quantity_pieces"])

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/new-service-entry")
    await async_page.wait_for_load_state("networkidle")

    await async_page.get_by_placeholder("Name of service person").fill("E2E Validation Qty")
    await async_page.get_by_placeholder("10-digit number").fill("9988776655")

    # Add apparatus with quantity > available stock
    app_input = async_page.locator("input[placeholder='Search apparatus...']").first
    await app_input.fill(apps[0])
    await async_page.wait_for_timeout(500)
    suggestion = async_page.locator(".nrf-suggestion-item").first
    if await suggestion.count() > 0:
        await suggestion.click()
        await async_page.wait_for_timeout(300)

    qty_input = async_page.locator("input[placeholder='Qty']").first
    await qty_input.fill(str(max_qty + 1))

    # Submit
    submit_btn = async_page.get_by_role("button", name="Send for Service")
    await submit_btn.scroll_into_view_if_needed()
    await submit_btn.click()
    await async_page.wait_for_timeout(2000)

    # Should still be on the form (server-side validation rejects it)
    assert "/new-service-entry" in async_page.url, (
        "Form submitted despite quantity exceeding available stock"
    )


# ── Test: Action lifecycle — repaired + damaged via UI ──

async def test_service_entry_action_lifecycle(async_page):
    apps = _get_apparatus(min_stock=10, min_count=1)
    if not apps:
        pytest.skip("Need at least 1 apparatus with stock >= 10")

    # Create entry via API with 1 item qty=5
    entry = _create_service_entry([(apps[0], 5)])
    entry_id = entry["id"]

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/service-entry/{entry_id}")
    await async_page.wait_for_load_state("networkidle")
    await async_page.wait_for_timeout(1000)

    # Click "Repaired" button for the item
    repaired_btn = async_page.locator(".repaired-btn").first
    await repaired_btn.scroll_into_view_if_needed()
    await repaired_btn.click()
    await async_page.wait_for_timeout(500)

    # Action popup should be visible — enter quantity
    popup_qty = async_page.locator(".modal-content-modern input[type='number']")
    await popup_qty.fill("3")
    await async_page.get_by_role("button", name="Confirm").click()
    await async_page.wait_for_timeout(1500)

    # Refresh the page to get latest state from server
    await async_page.reload()
    await async_page.wait_for_load_state("networkidle")
    await async_page.wait_for_timeout(500)

    # Verify remaining qty shows 2 (5 - 3 = 2)
    body_text = await async_page.locator(".sd-chem-list").inner_text()
    assert "2" in body_text, f"Expected remaining qty 2, got: {body_text}"

    # Now click "Damaged" to zero out the remaining 2
    damaged_btn = async_page.locator(".damaged-btn").first
    await damaged_btn.scroll_into_view_if_needed()
    await damaged_btn.click()
    await async_page.wait_for_timeout(500)

    popup_qty = async_page.locator(".modal-content-modern input[type='number']")
    await popup_qty.fill("2")
    await async_page.get_by_role("button", name="Confirm").click()
    await async_page.wait_for_timeout(1500)

    # Refresh and verify remaining is 0
    await async_page.reload()
    await async_page.wait_for_load_state("networkidle")
    await async_page.wait_for_timeout(500)

    body_text = await async_page.locator(".sd-chem-list").inner_text()
    assert "0" in body_text, f"Expected remaining qty 0, got: {body_text}"


# ── Test: Explicitly complete an entry ──

async def test_service_entry_complete(async_page):
    apps = _get_apparatus(min_stock=5, min_count=1)
    if not apps:
        pytest.skip("Need at least 1 apparatus with stock >= 5")

    # Create entry with 1 item qty=3
    entry = _create_service_entry([(apps[0], 3)])
    entry_id = entry["id"]
    item_id = entry["items"][0]["id"]

    # Action the full quantity so remaining = 0
    _action_item(entry_id, item_id, "repaired", 3)

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/service-entry/{entry_id}")
    await async_page.wait_for_load_state("networkidle")
    await async_page.wait_for_timeout(1000)

    # Complete button should be enabled
    complete_btn = async_page.locator(".sd-complete-btn")
    await complete_btn.scroll_into_view_if_needed()
    assert await complete_btn.is_enabled()

    await complete_btn.click()
    await async_page.wait_for_timeout(3000)

    # Should navigate back to list
    try:
        await async_page.wait_for_url(f"{BASE_URL}/damaged-entry", timeout=8000)
    except Exception:
        pass

    # Verify via API
    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(
        f"{BASE_API}/service-entries/{entry_id}/", headers=headers
    )
    assert r.status_code == 200
    assert r.json()["status"] == "completed"
    assert r.json()["completed_at"] is not None


# ── Test: Complete rejected when items still remain ──
# Frontend disables the button; backend also rejects with 400.

async def test_service_entry_complete_rejects_partial(async_page):
    apps = _get_apparatus(min_stock=5, min_count=2)
    if len(apps) < 2:
        pytest.skip("Need at least 2 apparatus with stock >= 5")

    # Create entry with 2 items, each qty=2
    entry = _create_service_entry([(apps[0], 2), (apps[1], 2)])
    entry_id = entry["id"]
    items = entry["items"]

    # Action only the first item to zero; leave second with qty_remaining=2
    _action_item(entry_id, items[0]["id"], "repaired", 2)

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/service-entry/{entry_id}")
    await async_page.wait_for_load_state("networkidle")
    await async_page.wait_for_timeout(1000)

    # Frontend check: Complete button is disabled when items remain
    complete_btn = async_page.locator(".sd-complete-btn")
    await complete_btn.scroll_into_view_if_needed()
    assert await complete_btn.is_disabled()

    # Backend check: direct API call should reject with 400
    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(
        f"{BASE_API}/service-entries/{entry_id}/complete/",
        headers=headers,
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
    assert "Cannot complete" in r.json().get("error", ""), (
        f"Unexpected error message: {r.text}"
    )


# ── Test: HOD read-only access ──

async def test_service_entry_hod_read_only(async_page):
    # Create an entry as storekeeper first
    apps = _get_apparatus(min_stock=5, min_count=1)
    if not apps:
        pytest.skip("Need at least 1 apparatus with stock >= 5")

    entry = _create_service_entry([(apps[0], 3)])
    entry_id = entry["id"]

    await login_as(async_page, "hod")
    await async_page.goto(f"{BASE_URL}/service-entry/{entry_id}")
    await async_page.wait_for_load_state("networkidle")
    await async_page.wait_for_timeout(1000)

    # HOD sees detail card with service code
    assert await async_page.locator(".sd-card").is_visible()
    assert await async_page.locator(f"text={entry['service_code']}").is_visible()

    # HOD has no action buttons
    assert await async_page.locator(".repaired-btn").count() == 0
    assert await async_page.locator(".damaged-btn").count() == 0
    assert await async_page.locator(".sd-complete-btn").count() == 0

    # Backend: HOD cannot create service entries
    hod_token = get_token("hod")
    hod_headers = {"Authorization": f"Bearer {hod_token}"}
    r = requests.post(
        f"{BASE_API}/service-entries/",
        json={"service_person_name": "HOD Attempt", "items": []},
        headers=hod_headers,
    )
    assert r.status_code == 403, (
        f"HOD create should be 403, got {r.status_code}: {r.text}"
    )

    # Backend: HOD cannot complete entries
    r = requests.post(
        f"{BASE_API}/service-entries/{entry_id}/complete/",
        headers=hod_headers,
    )
    assert r.status_code == 403, (
        f"HOD complete should be 403, got {r.status_code}: {r.text}"
    )

    # Backend: HOD can list entries
    r = requests.get(
        f"{BASE_API}/service-entries/",
        headers=hod_headers,
    )
    assert r.status_code == 200
    data = r.json()
    entries = data if isinstance(data, list) else data.get("results", [])
    ids = [e["id"] for e in entries]
    assert entry_id in ids, "HOD cannot see service entries in list"
