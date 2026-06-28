import os
import pytest
import pytest_asyncio
from playwright.async_api import async_playwright

from helpers_e2e import BASE_URL, SCREENSHOT_DIR

BASE_API = "http://localhost:8000/api"


@pytest_asyncio.fixture
async def browser_context():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 375, "height": 812})
        yield context
        await browser.close()


@pytest_asyncio.fixture
async def async_page(browser_context):
    page = await browser_context.new_page()
    yield page
    await page.close()


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)


@pytest_asyncio.fixture(autouse=True)
async def screenshot_on_failure(async_page, request):
    yield
    if hasattr(request.node, "rep_call") and request.node.rep_call.failed:
        await async_page.screenshot(path=os.path.join(SCREENSHOT_DIR, f"{request.node.name}.png"))
