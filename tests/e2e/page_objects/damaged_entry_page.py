"""Page Object: Damaged Entry pages."""
from playwright.sync_api import Page
import os

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")


class DamagedEntryPage:
    URL = f"{BASE_URL}/damaged-entry"

    def __init__(self, page: Page):
        self.page = page
        self.page_title = page.locator("h1:has-text('Damaged'), .page-title:has-text('Damaged')")
        self.table_rows = page.locator("table tbody tr")
        self.add_button = page.locator('a[href="/new-damaged-entry"], button:has-text("Add")').first
        self.search_input = page.locator('input[placeholder*="Search"]').first

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def get_row_count(self) -> int:
        return self.table_rows.count()

    def click_row(self, index: int = 0):
        self.table_rows.nth(index).click()
        self.page.wait_for_load_state("networkidle")

    def click_add(self):
        self.add_button.click()
        self.page.wait_for_url("**/new-damaged-entry")


class NewDamagedEntryPage:
    URL = f"{BASE_URL}/new-damaged-entry"

    def __init__(self, page: Page):
        self.page = page
        self.staff_input = page.locator('input[placeholder*="Staff"], select').first
        self.class_select = page.locator('select').first
        self.date_input = page.locator('input[type="date"]').first
        self.details_input = page.locator('textarea[placeholder*="Detail"], textarea').first
        self.day_order_input = page.locator('input[placeholder*="Day Order"], input[name="day_order"]').first
        self.add_item_btn = page.locator('button:has-text("Add"), button:has-text("Add Item")').first
        self.submit_btn = page.locator('button[type="submit"], button:has-text("Save")').first
        self.back_btn = page.locator('a[href="/damaged-entry"], button:has-text("Back")').first

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def get_item_inputs(self, index: int = 0):
        return {
            "name": self.page.locator("input[placeholder*='Apparatus'], input[placeholder*='apparatus']").nth(index),
            "quantity": self.page.locator("input[placeholder*='Quantity'], input[placeholder*='quantity']").nth(index),
            "caused_by": self.page.locator("input[placeholder*='caused'], input[placeholder*='Caused']").nth(index),
        }

    def add_item(self):
        self.add_item_btn.click()
        self.page.wait_for_timeout(300)

    def submit(self):
        self.submit_btn.click()
        self.page.wait_for_load_state("networkidle")
