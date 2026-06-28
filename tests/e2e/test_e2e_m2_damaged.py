import time
import pytest
import requests
from helpers_e2e import BASE_API, BASE_URL, login_as, get_token, click_submit


async def test_damaged_entry_form_visible(async_page):
    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/new-damaged-entry")
    await async_page.wait_for_load_state("networkidle")

    assert await async_page.get_by_placeholder("Name of staff").is_visible()
    assert await async_page.get_by_placeholder("e.g. 10th A").is_visible()
    assert await async_page.locator("input[type='date']").first.is_visible()
    assert await async_page.get_by_placeholder("Search apparatus...").is_visible()
    assert await async_page.get_by_placeholder("Qty").first.is_visible()
    assert await async_page.get_by_placeholder("Caused by...").is_visible()
    assert await async_page.get_by_role("button", name="File Damage Report").is_visible()


async def test_damaged_entry_creates_record(async_page):
    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/new-damaged-entry")
    await async_page.wait_for_load_state("networkidle")

    await async_page.get_by_placeholder("Name of staff").fill("E2E Test Staff")
    await async_page.get_by_placeholder("e.g. 10th A").fill("III B.Sc Chemistry")

    await async_page.get_by_placeholder("Search apparatus...").fill("Beaker")
    await async_page.wait_for_timeout(500)
    suggestion = async_page.locator(".nrf-suggestion-item").first
    if await suggestion.count() > 0:
        await suggestion.click()
        await async_page.wait_for_timeout(300)

    await async_page.get_by_placeholder("Qty").first.fill("5")
    await async_page.get_by_placeholder("Caused by...").fill("Accidental drop")
    await async_page.get_by_placeholder("Describe how it happened in detail...").fill("Beaker slipped during lab session")

    await click_submit(async_page)
    await async_page.wait_for_timeout(2000)

    try:
        await async_page.wait_for_url(f"{BASE_URL}/damaged-entry", timeout=5000)
    except Exception:
        pass

    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_API}/damaged_entry/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    entries = data if isinstance(data, list) else data.get("results", [])
    match = [de for de in entries if de.get("staff") == "E2E Test Staff"]
    assert len(match) >= 1, f"Damaged entry not found via API. Total entries: {len(entries)}"


async def test_damaged_entry_decrements_inventory(async_page):
    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_API}/available_apparatus/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    apps = data if isinstance(data, list) else data.get("results", [])
    target = next((a for a in apps if a.get("available_quantity_pieces", 0) >= 10), None)
    if target is None:
        pytest.skip("No apparatus with sufficient stock for decrement test")

    before_qty = int(target["available_quantity_pieces"])
    app_name = target["apparatus_name"]

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/new-damaged-entry")
    await async_page.wait_for_load_state("networkidle")

    await async_page.get_by_placeholder("Name of staff").fill("Decrement Test")
    await async_page.get_by_placeholder("e.g. 10th A").fill("I B.Sc Chemistry")
    await async_page.get_by_placeholder("Search apparatus...").fill(app_name)
    await async_page.get_by_placeholder("Qty").first.fill("3")
    await async_page.get_by_placeholder("Caused by...").fill("Test")
    await async_page.get_by_placeholder("Describe how it happened in detail...").fill("Test decrement")

    await click_submit(async_page)

    try:
        await async_page.wait_for_url(f"{BASE_URL}/damaged-entry", timeout=8000)
    except Exception:
        pass

    r = requests.get(f"{BASE_API}/available_apparatus/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    apps = data if isinstance(data, list) else data.get("results", [])
    updated = next(a for a in apps if a["apparatus_name"] == app_name)
    after_qty = int(updated["available_quantity_pieces"])
    assert after_qty <= before_qty - 3, f"Inventory not decremented: {before_qty} -> {after_qty}"


async def test_damaged_entry_cannot_exceed_available_stock(async_page):
    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_API}/available_apparatus/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    apps = data if isinstance(data, list) else data.get("results", [])
    target = next((a for a in apps if a.get("available_quantity_pieces", 0) >= 1), None)
    if target is None:
        pytest.skip("No apparatus with stock for overflow test")

    app_name = target["apparatus_name"]

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/new-damaged-entry")
    await async_page.wait_for_load_state("networkidle")

    await async_page.get_by_placeholder("Name of staff").fill("Overflow Test")
    await async_page.get_by_placeholder("e.g. 10th A").fill("II B.Sc Chemistry")
    await async_page.get_by_placeholder("Search apparatus...").fill(app_name)
    await async_page.get_by_placeholder("Qty").first.fill("999999")
    await async_page.get_by_placeholder("Caused by...").fill("Test overflow")
    await async_page.get_by_placeholder("Describe how it happened in detail...").fill("Testing overflow validation")

    await click_submit(async_page)

    time.sleep(2)
    assert "/new-damaged-entry" in async_page.url or "error" in (await async_page.content()).lower()
