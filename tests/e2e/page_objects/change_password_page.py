"""Page Object: Change Password page."""
from playwright.sync_api import Page
import os

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")


class ChangePasswordPage:
    URL = f"{BASE_URL}/change-password"

    def __init__(self, page: Page):
        self.page = page
        self.new_password_input = page.locator('input[placeholder="At least 8 characters"]')
        self.confirm_password_input = page.locator('input[placeholder="Repeat new password"]')
        self.current_password_input = page.locator('input[placeholder="Enter current password"]')
        self.submit_btn = page.locator('button[type="submit"]:has-text("Update Password")')
        self.back_btn = page.locator('button:has-text("Back")')
        self.error_alert = page.locator(".alert-error")
        self.success_alert = page.locator(".alert-success")

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def set_new_password(self, new_pw: str, confirm_pw: str):
        self.new_password_input.fill(new_pw)
        self.confirm_password_input.fill(confirm_pw)

    def set_current_password(self, current_pw: str):
        self.current_password_input.fill(current_pw)

    def submit(self):
        self.submit_btn.click()

    def change_password(self, new_pw: str, confirm_pw: str):
        self.set_new_password(new_pw, confirm_pw)
        self.submit()

    def change_password_full(self, old_pw: str, new_pw: str, confirm_pw: str):
        self.set_current_password(old_pw)
        self.set_new_password(new_pw, confirm_pw)
        self.submit()

    def get_error_text(self) -> str:
        return self.error_alert.text_content() or ""

    def get_success_text(self) -> str:
        return self.success_alert.text_content() or ""

    def has_error(self) -> bool:
        return self.error_alert.is_visible()

    def has_success(self) -> bool:
        return self.success_alert.is_visible()

    def wait_for_success(self, timeout=5000):
        self.success_alert.wait_for(state="visible", timeout=timeout)
