import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=300)
        page = await browser.new_page(viewport={'width':1280,'height':800})
        await page.goto('http://localhost:3000/login', timeout=30000)
        await page.get_by_role('textbox', name='Employee ID').fill('test_store_keeper')
        await page.get_by_role('textbox', name='Password').fill('Test@1234')
        await page.get_by_role('button', name='Log In').click()
        await page.wait_for_function('window.location.pathname !== "/login"', timeout=15000)
        print('Final URL:', page.url)
        await page.close()
        await browser.close()

asyncio.run(main())
