"""Page Object: Issue Register pages."""
from playwright.sync_api import Page
import os

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")


class IssueRegisterPage:
    URL = f"{BASE_URL}/issue-register"

    def __init__(self, page: Page):
        self.page = page
        self.page_title = page.locator("h1:has-text('Issue Register'), .page-title")
        self.table_rows = page.locator("table tbody tr")
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


class IssueRegisterDetailPage:
    def __init__(self, page: Page):
        self.page = page
        self.status_badge = page.locator("[class*='status'], .badge").first
        self.chemical_table = page.locator("table").first

    def goto(self, ir_id: int):
        self.page.goto(f"{BASE_URL}/issue-register/{ir_id}")
        self.page.wait_for_load_state("networkidle")
        return self

    def get_chemical_rows(self) -> int:
        return self.page.locator("table tbody tr").count()
