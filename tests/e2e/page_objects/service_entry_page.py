"""Page Object: Service Entry pages."""
from playwright.sync_api import Page
import os

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")


class NewServiceEntryPage:
    URL = f"{BASE_URL}/new-service-entry"

    def __init__(self, page: Page):
        self.page = page
        self.service_person_input = page.locator('input[placeholder*="Person"], input[placeholder*="person"]').first
        self.contact_input = page.locator('input[placeholder*="Contact"], input[placeholder*="contact"]').first
        self.email_input = page.locator('input[placeholder*="Email"], input[type="email"]').first
        self.company_input = page.locator('input[placeholder*="Company"], input[placeholder*="company"]').first
        self.deliver_by_input = page.locator('input[type="date"]').first
        self.add_item_btn = page.locator('button:has-text("Add"), button:has-text("Add Item")').first
        self.submit_btn = page.locator('button[type="submit"], button:has-text("Save")').first
        self.back_btn = page.locator('a[href="/inventory"], button:has-text("Back")').first

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def get_item_inputs(self, index: int = 0):
        return {
            "name": self.page.locator("input[placeholder*='Apparatus'], input[placeholder*='apparatus']").nth(index),
            "qty_sent": self.page.locator("input[placeholder*='Sent'], input[placeholder*='sent']").nth(index),
        }

    def add_item(self):
        self.add_item_btn.click()
        self.page.wait_for_timeout(300)

    def submit(self):
        self.submit_btn.click()
        self.page.wait_for_load_state("networkidle")


class ServiceEntryDetailPage:
    def __init__(self, page: Page):
        self.page = page
        self.status_badge = page.locator("[class*='status'], .badge").first
        self.repair_btn = page.locator('button:has-text("Repair"), button:has-text("Repaired")').first
        self.return_btn = page.locator('button:has-text("Return"), button:has-text("Returned")').first
        self.complete_btn = page.locator('button:has-text("Complete"), button:has-text("Mark Complete")').first

    def goto(self, entry_id: int):
        self.page.goto(f"{BASE_URL}/service-entry/{entry_id}")
        self.page.wait_for_load_state("networkidle")
        return self

    def get_status(self) -> str:
        return self.status_badge.text_content().strip().lower() if self.status_badge.count() > 0 else ""

    def action_item(self, action_type: str, quantity: int):
        btn = self.page.locator(f"button:has-text('{action_type}')").first
        if btn.count() > 0:
            btn.click()
            self.page.wait_for_timeout(300)
            qty_input = self.page.locator("input[placeholder*='quantity'], input[placeholder*='Quantity']").first
            if qty_input.count() > 0:
                qty_input.fill(str(quantity))
            confirm = self.page.locator("button:has-text('Confirm'), button:has-text('Save'), button:has-text('Yes')")
            if confirm.count() > 0:
                confirm.first.click()
            self.page.wait_for_load_state("networkidle")

    def complete_entry(self):
        self.complete_btn.click()
        self.page.wait_for_timeout(300)
        confirm = self.page.locator("button:has-text('Confirm'), button:has-text('Yes')")
        if confirm.count() > 0:
            confirm.first.click()
        self.page.wait_for_load_state("networkidle")
