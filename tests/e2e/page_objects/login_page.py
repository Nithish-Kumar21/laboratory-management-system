"""Page Object: Login page."""
from playwright.sync_api import Page, expect
import os

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")


class LoginPage:
    URL = f"{BASE_URL}/login"

    def __init__(self, page: Page):
        self.page = page
        self.employee_id_input = page.locator('input[aria-label="Employee ID"]').nth(1)
        self.password_input = page.locator('input[aria-label="Password"]').nth(1)
        self.submit_btn = page.locator('button[type="submit"]').nth(1)
        self.error_msg = page.locator('div:has(> .text-red-200)').nth(1)
        self.show_password_btn = page.locator('button[aria-label="Show password"]').nth(1)
        self.forgot_password_link = page.locator('a:has-text("Forgot Password")').nth(1)

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def login(self, employee_id: str, password: str):
        self.employee_id_input.fill(employee_id)
        self.password_input.fill(password)
        self.submit_btn.click()

    def login_and_wait(self, employee_id: str, password: str, timeout: int = 20000):
        self.login(employee_id, password)
        self.page.wait_for_function(
            "() => window.location.pathname !== '/login'",
            timeout=timeout,
        )
        self.page.wait_for_load_state("networkidle")
        try:
            self.page.wait_for_url("**/inventory**", timeout=timeout // 2)
        except Exception:
            pass
        self.page.wait_for_load_state("networkidle")

    def get_error_text(self) -> str:
        try:
            self.page.wait_for_selector('text=Invalid Employee ID or password', timeout=5000, state="visible")
            return self.page.locator('text=Invalid Employee ID or password').first.text_content() or ""
        except Exception:
            return ""

    def toggle_password_visibility(self):
        self.show_password_btn.click()

    def is_password_visible(self) -> bool:
        input_type = self.password_input.get_attribute("type")
        return input_type == "text"

    def click_forgot_password(self):
        self.forgot_password_link.click()
        self.page.wait_for_url("**/forgot-password")

    def wait_for_page_load(self):
        self.page.wait_for_load_state("networkidle")
        self.employee_id_input.wait_for(state="visible")
