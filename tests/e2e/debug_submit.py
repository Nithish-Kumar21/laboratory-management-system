"""Debug script with network request monitoring."""
from playwright.sync_api import sync_playwright

BASE_URL = 'http://localhost:3000'

api_requests = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, slow_mo=100)
    context = browser.new_context()
    page = context.new_page()

    # Monitor all requests
    page.on('request', lambda req: print(f'[REQ] {req.method} {req.url[:100]}'))
    page.on('response', lambda resp: print(f'[RES] {resp.status} {resp.url[:100]}'))
    page.on('console', lambda msg: print(f'[CON] [{msg.type}] {msg.text[:200]}'))

    # Also monitor page errors
    page.on('pageerror', lambda err: print(f'[PAGE_ERR] {err}'))

    # Login
    page.goto(f'{BASE_URL}/login')
    page.wait_for_selector("input[placeholder*='employee ID']", timeout=10000)
    page.fill("input[placeholder*='employee ID']", 'test_store_keeper')
    page.fill("input[placeholder='Enter password']", 'Test@1234')
    page.click("button.login-submit-btn")
    page.wait_for_function('window.location.pathname !== "/login"', timeout=15000)
    print(f'Logged in, URL: {page.url}')

    # Go to new stock form
    page.goto(f'{BASE_URL}/new-stock-register')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)

    # Fill form
    page.fill("input[placeholder='INV-REF-001']", 'TEST-DEBUG-NET-789')
    page.fill("input[type='date']", '2026-07-07')
    page.fill("input[placeholder='Supplier name...']", 'Debug Supplier')
    page.fill("input[placeholder='Phone number']", '9876543210')
    page.fill("input[type='email']", 'test@test.com')

    entry = page.locator('.nrf-chem-entry').first
    entry.fill("input[placeholder='Chemical name...']", 'Debug Chem')
    entry.fill("input[placeholder='Pack size']", '100')
    entry.fill("input[placeholder='No. of packs']", '2')
    page.fill("input[placeholder*='Rate']", '50')
    entry.fill("input[placeholder='Make / Brand']", 'DebugMake')
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)

    print('\n--- Clicking Finalize Stock Entry ---')
    page.click("button:has-text('Finalize Stock Entry')")
    page.wait_for_timeout(5000)
    print(f'URL after submit: {page.url}')

    page.wait_for_timeout(2000)
    browser.close()
