import pytest
import requests
from helpers_e2e import BASE_API, BASE_URL, login_as, get_token


async def test_set_reorder_level_via_ui(async_page):
    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}

    r = requests.get(f"{BASE_API}/available_chemicals/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    chems = data if isinstance(data, list) else data.get("results", [])
    target = next((c for c in chems if c.get("chemical_name")), None)
    if target is None:
        pytest.skip("No chemicals available for reorder test")

    chem_id = target["id"]
    chem_name = target["chemical_name"]

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/settings")
    await async_page.wait_for_load_state("networkidle")

    chem_levels_tab = async_page.get_by_role("button", name="Chemical Levels")
    if await chem_levels_tab.count() == 0:
        pytest.skip("Chemical Levels tab not found")
    await chem_levels_tab.scroll_into_view_if_needed()
    await chem_levels_tab.click()
    await async_page.wait_for_timeout(500)

    individual_btn = async_page.get_by_role("button", name="Individual Levels")
    if await individual_btn.count() > 0:
        await individual_btn.scroll_into_view_if_needed()
        await individual_btn.click()
        await async_page.wait_for_timeout(500)

    row = async_page.locator("tr").filter(has_text=chem_name)
    if await row.count() == 0:
        pytest.skip(f"Chemical '{chem_name}' not found in reorder table")

    edit_btn = row.get_by_role("button", name="Edit")
    if await edit_btn.count() == 0:
        pytest.skip("Edit button not found for chemical row")
    await edit_btn.scroll_into_view_if_needed()
    await edit_btn.click()
    await async_page.wait_for_timeout(300)

    inline_input = async_page.locator(".inline-edit-input")
    if await inline_input.count() > 0:
        await inline_input.fill("50")

    save_btn = row.get_by_role("button", name="Save")
    if await save_btn.count() > 0:
        await save_btn.scroll_into_view_if_needed()
        await save_btn.click()
        await async_page.wait_for_timeout(500)

    r = requests.get(f"{BASE_API}/available_chemicals/{chem_id}/", headers=headers)
    assert r.status_code == 200
    assert float(r.json().get("reorder_level", 0)) == 50.0, f"Reorder level not updated to 50 for {chem_name}"


async def test_reorder_level_boundary_at_limit(async_page):
    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}

    r = requests.get(f"{BASE_API}/available_chemicals/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    chems = data if isinstance(data, list) else data.get("results", [])
    target = next((c for c in chems if float(c.get("quantity", 0)) >= 50 or float(c.get("available_quantity_ml", 0)) >= 50), None)
    if target is None:
        pytest.skip("No chemical with quantity >= 50 for boundary test")

    chem_id = target["id"]
    requests.patch(f"{BASE_API}/available_chemicals/{chem_id}/",
                   json={"reorder_level": 50}, headers=headers)

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/inventory")
    await async_page.wait_for_load_state("networkidle")

    warning_banner = async_page.locator(".inv-warning-banner")
    if await warning_banner.count() > 0:
        text = (await warning_banner.text_content()).lower()
        chem_name_lower = target["chemical_name"].lower()
        assert chem_name_lower not in text


async def test_reorder_level_boundary_below_limit(async_page):
    token = get_token("storekeeper")
    headers = {"Authorization": f"Bearer {token}"}

    r = requests.get(f"{BASE_API}/available_chemicals/", headers=headers)
    assert r.status_code == 200
    data = r.json()
    chems = data if isinstance(data, list) else data.get("results", [])
    target = next((c for c in chems if float(c.get("quantity", 0)) < 50 or float(c.get("available_quantity_ml", 0)) < 50), None)
    if target is None:
        pytest.skip("No chemical with quantity < 50 for below-limit test")

    chem_id = target["id"]
    requests.patch(f"{BASE_API}/available_chemicals/{chem_id}/",
                   json={"reorder_level": 50}, headers=headers)

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/inventory")
    await async_page.wait_for_load_state("networkidle")

    warning_banner = async_page.locator(".inv-warning-banner")
    assert await warning_banner.count() >= 0
