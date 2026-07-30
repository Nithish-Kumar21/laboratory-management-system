"""Page Object: Stock Register pages."""
from playwright.sync_api import Page
import os

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")


class StockRegisterPage:
    URL = f"{BASE_URL}/stock-register"

    def __init__(self, page: Page):
        self.page = page
        self.page_title = page.locator("h1:has-text('Stock Register'), .page-title:has-text('Stock Register')")
        self.search_input = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first
        self.table_rows = page.locator("table tbody tr")
        self.add_button = page.locator('a[href="/new-stock-register"], button:has-text("Add")')

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def search(self, term: str):
        self.search_input.fill(term)
        self.page.wait_for_timeout(300)

    def get_row_count(self) -> int:
        return self.table_rows.count()

    def click_row(self, index: int = 0):
        self.table_rows.nth(index).click()
        self.page.wait_for_load_state("networkidle")

    def click_add(self):
        self.add_button.first.click()
        self.page.wait_for_url("**/new-stock-register")

    def get_invoice_numbers(self) -> list:
        cells = self.page.locator("table tbody tr td").all()
        return [c.text_content().strip() for c in cells[:5]]


class NewStockRegisterPage:
    URL = f"{BASE_URL}/new-stock-register"

    def __init__(self, page: Page):
        self.page = page
        self.invoice_input = page.locator('input[name="invoice_number"], input[placeholder*="Invoice"]').first
        self.date_input = page.locator('input[type="date"]').first
        self.supplier_input = page.locator('input[placeholder*="Supplier"], input[name="supplier_name"]').first
        self.phone_input = page.locator('input[placeholder*="Phone"], input[placeholder*="phone"]').first
        self.remarks_input = page.locator('textarea[placeholder*="Remark"], textarea').first
        self.add_chemical_btn = page.locator('button:has-text("Add Chemical"), button:has-text("Chemical")').first
        self.add_apparatus_btn = page.locator('button:has-text("Add Apparatus"), button:has-text("Apparatus")').first
        self.submit_btn = page.locator('button[type="submit"]:has-text("Save"), button:has-text("Submit")').first
        self.back_btn = page.locator('a[href="/stock-register"], button:has-text("Back")').first
        self.error_alert = page.locator(".alert-error, .error-message, [class*='error']").first

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def fill_invoice(self, value: str):
        self.invoice_input.fill(value)

    def fill_supplier(self, value: str):
        self.supplier_input.fill(value)

    def fill_phone(self, value: str):
        self.phone_input.fill(value)

    def add_chemical_row(self):
        self.add_chemical_btn.click()
        self.page.wait_for_timeout(300)

    def add_apparatus_row(self):
        self.add_apparatus_btn.click()
        self.page.wait_for_timeout(300)

    def get_chemical_inputs(self) -> dict:
        return {
            "name": self.page.locator('input[placeholder*="Chemical name"], input[placeholder*="chemical"]').first,
            "pack_size": self.page.locator('input[placeholder*="Pack"], input[placeholder*="pack"]').first,
            "rate": self.page.locator('input[placeholder*="Rate"], input[placeholder*="rate"]').first,
            "make": self.page.locator('input[placeholder*="Make"], input[placeholder*="make"]').first,
            "reorder": self.page.locator('input[placeholder*="Reorder"], input[placeholder*="reorder"]').first,
        }

    def get_apparatus_inputs(self) -> dict:
        return {
            "name": self.page.locator('input[placeholder*="Apparatus name"], input[placeholder*="apparatus"]').first,
            "qty": self.page.locator('input[placeholder*="Quantity"], input[placeholder*="quantity"]').first,
            "rate": self.page.locator('input[placeholder*="Rate"], input[placeholder*="rate"]').first,
            "make": self.page.locator('input[placeholder*="Make"], input[placeholder*="make"]').first,
            "reorder": self.page.locator('input[placeholder*="Reorder"], input[placeholder*="reorder"]').first,
        }

    def submit(self):
        self.submit_btn.click()
        self.page.wait_for_load_state("networkidle")
