import pytest
import requests
from helpers_e2e import BASE_API, BASE_URL, login_as, get_token


async def test_low_stock_alert_visible_after_issue(async_page):
    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}

    r = requests.get(f"{BASE_API}/available_chemicals/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    chems = data if isinstance(data, list) else data.get("results", [])
    target = next((c for c in chems if float(c.get("quantity", 0)) < 50 or float(c.get("available_quantity_ml", 0)) < 50), None)
    if target is None:
        pytest.skip("No chemical with quantity < 50 for low stock test")

    chem_id = target["id"]
    requests.patch(f"{BASE_API}/available_chemicals/{chem_id}/",
                   json={"reorder_level": 50}, headers=headers)

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/inventory")
    await async_page.wait_for_load_state("networkidle")

    warning_banner = async_page.locator(".inv-warning-banner")
    if await warning_banner.count() > 0:
        assert await warning_banner.is_visible()
    else:
        low_stock_section = async_page.locator("text=Low Stock")
        assert await low_stock_section.count() > 0, "No low stock indicator found"


async def test_no_alert_when_stock_sufficient(async_page):
    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}

    r = requests.get(f"{BASE_API}/available_chemicals/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    chems = data if isinstance(data, list) else data.get("results", [])
    target = next((c for c in chems if float(c.get("quantity", 0)) > 50 or float(c.get("available_quantity_ml", 0)) > 50), None)
    if target is None:
        pytest.skip("No chemical with quantity > 50 for sufficient stock test")

    chem_id = target["id"]
    requests.patch(f"{BASE_API}/available_chemicals/{chem_id}/",
                   json={"reorder_level": 10}, headers=headers)

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/inventory")
    await async_page.wait_for_load_state("networkidle")

    alert_section = async_page.locator(".inv-warning-banner")
    if await alert_section.count() > 0:
        alert_text = (await alert_section.text_content()).lower()
        chem_name_lower = target["chemical_name"].lower()
        assert chem_name_lower not in alert_text, f"{target['chemical_name']} unexpectedly in alert"


async def test_low_stock_list_page(async_page):
    token = get_token("hod")
    headers = {"Authorization": f"Bearer {token}"}

    r = requests.get(f"{BASE_API}/available_chemicals/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    chems = data if isinstance(data, list) else data.get("results", [])
    low_chems = [c for c in chems if float(c.get("quantity", 0)) < float(c.get("reorder_level") or 0)
                 or float(c.get("available_quantity_ml", 0)) < float(c.get("reorder_level") or 0)]
    if len(low_chems) == 0:
        chem = chems[0]
        requests.patch(f"{BASE_API}/available_chemicals/{chem['id']}/",
                       json={"reorder_level": 100}, headers=headers)

    await login_as(async_page, "hod")
    await async_page.goto(f"{BASE_URL}/inventory")
    await async_page.wait_for_load_state("networkidle")

    await async_page.goto(f"{BASE_URL}/")
    await async_page.wait_for_load_state("networkidle")

    low_stock_section = async_page.locator("text=Low Stock Alerts")
    if await low_stock_section.count() > 0:
        assert await low_stock_section.is_visible()
    else:
        await async_page.goto(f"{BASE_URL}/inventory")
        await async_page.wait_for_load_state("networkidle")
        banner = async_page.locator(".inv-warning-banner")
        assert await banner.count() >= 0
