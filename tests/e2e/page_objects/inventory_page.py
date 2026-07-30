"""Page Object: Inventory page."""
from playwright.sync_api import Page
import os

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")


class InventoryPage:
    URL = f"{BASE_URL}/inventory"

    def __init__(self, page: Page):
        self.page = page
        self.page_title = page.locator(".inv-page-title, h1:has-text('Inventory')")
        self.chemicals_tab = page.locator('button.inv-tab:has-text("Chemicals")')
        self.apparatus_tab = page.locator('button.inv-tab:has-text("Apparatus")')
        self.search_input = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first
        self.low_stock_filter = page.locator('input[type="checkbox"]').first
        self.chemical_table = page.locator("table, .chemical-table, [class*='table']").first
        self.apparatus_table = page.locator("table, .apparatus-table, [class*='table']").first

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def click_chemicals_tab(self):
        self.chemicals_tab.click()
        self.page.wait_for_timeout(500)

    def click_apparatus_tab(self):
        self.apparatus_tab.click()
        self.page.wait_for_timeout(500)

    def search(self, term: str):
        self.search_input.fill(term)
        self.page.wait_for_timeout(300)

    def get_visible_rows(self):
        return self.page.locator("table tbody tr, .table-row").all()

    def is_chemical_visible(self, name: str) -> bool:
        return self.page.locator(f"table tbody tr:has-text('{name}')").count() > 0

    def toggle_low_stock_filter(self):
        self.low_stock_filter.click()
        self.page.wait_for_timeout(500)

    def get_row_count(self) -> int:
        return self.page.locator("table tbody tr").count()
