import pytest
import requests
from helpers_e2e import BASE_API, BASE_URL, login_as, get_token, click_submit


async def test_stock_entry_form_visible(async_page):
    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/new-stock-register")
    await async_page.wait_for_load_state("networkidle")

    assert await async_page.get_by_placeholder("INV-REF-001").is_visible()
    assert await async_page.locator("input[type='date']").first.is_visible()
    assert await async_page.get_by_placeholder("Vendor full name...").is_visible()
    assert await async_page.get_by_placeholder("Item name...").first.is_visible()
    assert await async_page.get_by_placeholder("Qty").first.is_visible()
    assert await async_page.get_by_role("button", name="Finalize Stock Entry").is_visible()


async def test_stock_entry_creates_record(async_page):
    await login_as(async_page, "storekeeper")

    await async_page.goto(f"{BASE_URL}/new-stock-register")
    await async_page.wait_for_load_state("networkidle")

    unique_inv = f"INV-E2E-{int(__import__('time').time())}"

    await async_page.get_by_placeholder("INV-REF-001").fill(unique_inv)
    await async_page.get_by_placeholder("Vendor full name...").fill("E2E Test Supplier")
    await async_page.get_by_placeholder("Item name...").first.fill("Sulphuric Acid")
    await async_page.get_by_placeholder("Qty").first.fill("500")
    await async_page.get_by_placeholder("Price").first.fill("200")
    await async_page.get_by_placeholder("Make").first.fill("Merck")

    await click_submit(async_page)

    try:
        await async_page.wait_for_url(f"{BASE_URL}/stock-register", timeout=10000)
    except Exception:
        pass

    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_API}/stock_register/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    registers = data if isinstance(data, list) else data.get("results", [])
    match = [sr for sr in registers if unique_inv in (sr.get("invoice_number") or "")]
    assert len(match) >= 1, f"Stock entry '{unique_inv}' not found via API"


async def test_stock_entry_updates_inventory(async_page):
    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_API}/available_chemicals/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    chems = data if isinstance(data, list) else data.get("results", [])
    target = next((c for c in chems if c["chemical_name"] in ("Sulphuric Acid", "Sodium Hydroxide")), None)
    if target is None:
        pytest.skip("No suitable existing chemical found for inventory test")

    before_qty = float(target["quantity"]) if "quantity" in target else float(target.get("available_quantity_ml", 0))
    chem_name = target["chemical_name"]

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/new-stock-register")
    await async_page.wait_for_load_state("networkidle")

    unique_inv = f"INV-INV-{int(__import__('time').time())}"
    await async_page.get_by_placeholder("INV-REF-001").fill(unique_inv)
    await async_page.get_by_placeholder("Vendor full name...").fill("Inv Test Supplier")
    await async_page.get_by_placeholder("Item name...").first.fill(chem_name)
    await async_page.get_by_placeholder("Qty").first.fill("100")
    await async_page.get_by_placeholder("Price").first.fill("50")
    await async_page.get_by_placeholder("Make").first.fill("Test")

    await click_submit(async_page)

    try:
        await async_page.wait_for_url(f"{BASE_URL}/stock-register", timeout=8000)
    except Exception:
        pass

    r = requests.get(f"{BASE_API}/available_chemicals/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    chems = data if isinstance(data, list) else data.get("results", [])
    updated = next(c for c in chems if c["chemical_name"] == chem_name)
    after_qty = float(updated["quantity"]) if "quantity" in updated else float(updated.get("available_quantity_ml", 0))
    assert after_qty >= before_qty + 99, f"Inventory not increased sufficiently: {before_qty} -> {after_qty}"


async def test_stock_entry_validation(async_page):
    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/new-stock-register")
    await async_page.wait_for_load_state("networkidle")

    await click_submit(async_page)

    assert "/new-stock-register" in async_page.url
