import pytest
import pytest_asyncio
from playwright.async_api import async_playwright

@pytest_asyncio.fixture(scope="session")
async def headed_browser():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=300)
        yield browser
        await browser.close()

@pytest_asyncio.fixture
async def page(headed_browser):
    context = await headed_browser.new_context(viewport={"width": 1280, "height": 800})
    p = await context.new_page()
    yield p
    await p.evaluate("localStorage.clear()")
    await context.close()

class TestSimple:
    async def test_login_and_go(self, page):
        await page.goto("http://localhost:3000/login", timeout=30000)
        await page.get_by_role("textbox", name="Employee ID").fill("test_store_keeper")
        await page.get_by_role("textbox", name="Password").fill("Test@1234")
        await page.get_by_role("button", name="Log In").click()
        await page.wait_for_function('window.location.pathname !== "/login"', timeout=15000)
        print("Final URL:", page.url)
        assert "login" not in page.url
