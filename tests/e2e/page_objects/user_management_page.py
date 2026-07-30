"""Page Object: User Management pages."""
from playwright.sync_api import Page
import os

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")


class UserManagementPage:
    URL = f"{BASE_URL}/users"

    def __init__(self, page: Page):
        self.page = page
        self.page_title = page.locator("h1:has-text('User Management'), .page-title:has-text('User')")
        self.table_rows = page.locator("table tbody tr, .user-card, [class*='user-row']")
        self.create_button = page.locator('a[href="/users/create"], button:has-text("Create"), button:has-text("Add")').first
        self.search_input = page.locator('input[placeholder*="Search"]').first

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def get_row_count(self) -> int:
        return self.table_rows.count()

    def click_create(self):
        self.create_button.click()
        self.page.wait_for_url("**/users/create")

    def click_user(self, index: int = 0):
        self.table_rows.nth(index).click()
        self.page.wait_for_load_state("networkidle")


class CreateUserPage:
    URL = f"{BASE_URL}/users/create"

    def __init__(self, page: Page):
        self.page = page
        self.employee_id_input = page.locator('input[name="employee_id"], input[placeholder*="Employee"]').first
        self.full_name_input = page.locator('input[name="full_name"], input[placeholder*="Name"]').first
        self.email_input = page.locator('input[name="email"], input[type="email"]').first
        self.phone_input = page.locator('input[name="phone"], input[placeholder*="Phone"]').first
        self.role_select = page.locator('select[name="role"], select').first
        self.department_select = page.locator('select[name="department"]').first
        self.designation_input = page.locator('input[name="designation"], input[placeholder*="Designation"]').first
        self.password_input = page.locator('input[name="password"], input[type="password"]').first
        self.submit_btn = page.locator('button[type="submit"]').first
        self.back_btn = page.locator('a[href="/users"], button:has-text("Back")').first
        self.error_msg = page.locator(".error-message, [class*='error'], .alert-error").first

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def fill_form(self, data: dict):
        if "employee_id" in data:
            self.employee_id_input.fill(data["employee_id"])
        if "full_name" in data:
            self.full_name_input.fill(data["full_name"])
        if "email" in data:
            self.email_input.fill(data["email"])
        if "phone" in data:
            self.phone_input.fill(data["phone"])
        if "role" in data:
            self.role_select.select_option(value=data["role"])
        if "designation" in data:
            self.designation_input.fill(data["designation"])
        if "password" in data:
            self.password_input.fill(data["password"])

    def submit(self):
        self.submit_btn.click()
        self.page.wait_for_load_state("networkidle")

    def get_error_text(self) -> str:
        return self.error_msg.text_content() if self.error_msg.is_visible() else ""


class SettingsPage:
    URL = f"{BASE_URL}/settings"

    def __init__(self, page: Page):
        self.page = page
        self.page_title = page.locator("h1:has-text('Settings'), .page-title:has-text('Settings')")
        self.common_reorder_toggle = page.locator('input[type="checkbox"]').first
        self.common_chemical_reorder = page.locator('input[placeholder*="Chemical"], input[name*="chemical"]').first
        self.common_apparatus_reorder = page.locator('input[placeholder*="Apparatus"], input[name*="apparatus"]').first
        self.save_btn = page.locator('button:has-text("Save"), button[type="submit"]').first

    def goto(self):
        self.page.goto(self.URL)
        self.page.wait_for_load_state("networkidle")
        return self

    def toggle_common_reorder(self):
        self.common_reorder_toggle.click()

    def set_common_chemical_reorder(self, value: str):
        self.common_chemical_reorder.fill(value)

    def set_common_apparatus_reorder(self, value: str):
        self.common_apparatus_reorder.fill(value)

    def save(self):
        self.save_btn.click()
        self.page.wait_for_load_state("networkidle")
