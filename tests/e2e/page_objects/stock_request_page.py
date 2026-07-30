"""Page Object: Stock Request pages."""
from playwright.sync_api import Page
import os

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")


class StockRequestListPage:
    URL = f"{BASE_URL}/requests"

    def __init__(self, page: Page):
        self.page = page
        self.page_title = page.locator("h1:has-text('Chemical Request'), h1:has-text('Stock Request'), .page-title")
        self.table_rows = page.locator("table tbody tr, .request-card, [class*='request-row']")
        self.search_input = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first
        self.filter_btn = page.locator('button:has-text("Filter"), button[aria-label*="filter"]').first
        self.empty_state = page.locator("text=No requests found, text=No data, .empty-state")

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def get_row_count(self) -> int:
        return self.table_rows.count()

    def click_row(self, index: int = 0):
        self.table_rows.nth(index).click()
        self.page.wait_for_load_state("networkidle")

    def is_empty(self) -> bool:
        return self.empty_state.is_visible() if self.empty_state.count() > 0 else self.get_row_count() == 0


class NewChemicalRequestPage:
    URL = f"{BASE_URL}/new-request"

    def __init__(self, page: Page):
        self.page = page
        self.class_select = page.locator('select, [role="combobox"]').first
        self.date_input = page.locator('input[type="date"]').first
        self.day_order_select = page.locator('select').nth(1)
        self.purpose_select = page.locator('select:has-text("Practical"), select').first
        self.experiment_input = page.locator('input[placeholder*="Experiment"], textarea[placeholder*="experiment"]').first
        self.venue_input = page.locator('input[placeholder*="Venue"], input[placeholder*="venue"]').first
        self.add_chemical_btn = page.locator('button:has-text("Add Chemical"), button:has-text("Add")').first
        self.save_draft_btn = page.locator('button:has-text("Save Draft"), button:has-text("Draft")').first
        self.submit_btn = page.locator('button:has-text("Submit"), button[type="submit"]:has-text("Submit")').first
        self.back_btn = page.locator('button:has-text("Back"), a:has-text("Back")').first
        self.error_msg = page.locator(".error-message, [class*='error'], text=Required").first
        self.success_msg = page.locator(".success-message, [class*='success']")

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def get_chemical_row_inputs(self, index: int = 0):
        prefix = f"[data-index='{index}'], "
        return {
            "name": self.page.locator(f"input[placeholder*='Chemical name'], input[placeholder*='chemical']").nth(index),
            "quantity": self.page.locator(f"input[placeholder*='Quantity'], input[placeholder*='quantity'], input[type='number']").nth(index),
        }

    def add_chemical_row(self):
        self.add_chemical_btn.click()
        self.page.wait_for_timeout(300)

    def fill_experiment(self, name: str):
        self.experiment_input.fill(name)

    def select_hour(self, hour_index: int = 0):
        hour_buttons = self.page.locator("[class*='hour'] button, [class*='chip']")
        if hour_buttons.count() > hour_index:
            hour_buttons.nth(hour_index).click()

    def save_as_draft(self):
        if self.save_draft_btn.count() > 0:
            self.save_draft_btn.click()
        else:
            # Fallback: use the submit mechanism with draft status
            self.page.evaluate("""() => {
                const btns = document.querySelectorAll('button');
                for (const b of btns) {
                    if (b.textContent.includes('Draft') || b.textContent.includes('draft')) {
                        b.click();
                        return;
                    }
                }
            }""")
        self.page.wait_for_load_state("networkidle")

    def submit_request(self):
        self.submit_btn.click()
        self.page.wait_for_load_state("networkidle")

    def submit(self):
        self.submit_request()


class StockRequestDetailPage:
    def __init__(self, page: Page):
        self.page = page
        self.status_badge = page.locator("[class*='status'], .badge, [class*='badge']").first
        self.accept_btn = page.locator('button:has-text("Accept"), button:has-text("Approve")').first
        self.reject_btn = page.locator('button:has-text("Reject")').first
        self.issue_btn = page.locator('button:has-text("Issue"), button:has-text("Mark as Issued")').first
        self.complete_btn = page.locator('button:has-text("Complete"), button:has-text("Mark as Completed")').first
        self.report_usage_btn = page.locator('button:has-text("Report Usage"), button:has-text("Usage")').first
        self.cancel_btn = page.locator('button:has-text("Cancel")').first
        self.delete_btn = page.locator('button:has-text("Delete")').first
        self.edit_btn = page.locator('button:has-text("Edit")').first
        self.submit_draft_btn = page.locator('button:has-text("Submit")').first
        self.rejection_reason_input = page.locator('textarea[placeholder*="reason"], textarea[placeholder*="Reason"], input[placeholder*="reason"]').first
        self.confirm_dialog = page.locator(".confirm-dialog, [class*='modal'], [role='dialog']")
        self.confirm_yes_btn = page.locator("button:has-text('Yes'), button:has-text('Confirm'), button:has-text('OK')")
        self.toast = page.locator("[class*='toast'], [class*='notification'], [class*='alert']").first

    def goto(self, request_id: int):
        self.page.goto(f"{BASE_URL}/requests/{request_id}")
        self.page.wait_for_load_state("networkidle")
        return self

    def get_status(self) -> str:
        return self.status_badge.text_content().strip().lower() if self.status_badge.count() > 0 else ""

    def accept_request(self):
        self.accept_btn.click()
        self.page.wait_for_load_state("networkidle")

    def reject_request(self, reason: str):
        self.reject_btn.click()
        self.page.wait_for_timeout(300)
        if self.rejection_reason_input.is_visible():
            self.rejection_reason_input.fill(reason)
        # Confirm the rejection
        confirm_btns = self.page.locator("button:has-text('Reject'), button:has-text('Confirm'), button:has-text('Yes')")
        if confirm_btns.count() > 0:
            confirm_btns.last.click()
        self.page.wait_for_load_state("networkidle")

    def issue_request(self):
        self.issue_btn.click()
        self.page.wait_for_timeout(300)
        # Handle confirmation dialog if present
        if self.confirm_dialog.count() > 0 and self.confirm_yes_btn.count() > 0:
            self.confirm_yes_btn.first.click()
        self.page.wait_for_load_state("networkidle")

    def complete_request(self):
        self.complete_btn.click()
        self.page.wait_for_timeout(300)
        if self.confirm_dialog.count() > 0 and self.confirm_yes_btn.count() > 0:
            self.confirm_yes_btn.first.click()
        self.page.wait_for_load_state("networkidle")

    def report_usage(self, quantities: dict = None):
        if self.report_usage_btn.count() > 0:
            self.report_usage_btn.click()
            self.page.wait_for_timeout(500)
        if quantities:
            for item_id, qty in quantities.items():
                inp = self.page.locator(f"input[data-item-id='{item_id}'], input[placeholder*='used']").first
                if inp.count() > 0:
                    inp.fill(str(qty))
        # Submit usage report
        submit = self.page.locator("button:has-text('Submit'), button:has-text('Report'), button:has-text('Save')")
        if submit.count() > 0:
            submit.first.click()
        self.page.wait_for_load_state("networkidle")

    def submit_draft(self):
        self.submit_draft_btn.click()
        self.page.wait_for_timeout(300)
        if self.confirm_yes_btn.count() > 0 and self.confirm_yes_btn.first.is_visible():
            self.confirm_yes_btn.first.click()
        self.page.wait_for_load_state("networkidle")

    def cancel_request(self):
        self.cancel_btn.click()
        self.page.wait_for_timeout(300)
        if self.confirm_yes_btn.count() > 0 and self.confirm_yes_btn.first.is_visible():
            self.confirm_yes_btn.first.click()
        self.page.wait_for_load_state("networkidle")

    def delete_request(self):
        self.delete_btn.click()
        self.page.wait_for_timeout(300)
        if self.confirm_yes_btn.count() > 0 and self.confirm_yes_btn.first.is_visible():
            self.confirm_yes_btn.first.click()
        self.page.wait_for_load_state("networkidle")
