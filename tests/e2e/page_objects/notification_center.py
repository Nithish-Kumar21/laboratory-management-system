"""Page Object: Notification Center."""
from playwright.sync_api import Page
import os

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:3000")


class NotificationCenter:
    def __init__(self, page: Page):
        self.page = page
        self.bell_icon = page.locator("[class*='notification'] button, [class*='bell'], button[aria-label*='notification']").first
        self.badge = page.locator("[class*='badge'], [class*='count'], [class*='notification-count']").first
        self.dropdown = page.locator("[class*='dropdown'], [class*='notification-list']").first
        self.items = page.locator("[class*='notification-item'], [class*='notif']")

    def click_bell(self):
        if self.bell_icon.count() > 0:
            self.bell_icon.click()
            self.page.wait_for_timeout(300)

    def get_badge_count(self) -> int:
        if self.badge.count() > 0 and self.badge.is_visible():
            text = self.badge.text_content().strip()
            try:
                return int(text)
            except (ValueError, TypeError):
                return 0
        return 0

    def get_item_count(self) -> int:
        return self.items.count()

    def click_item(self, index: int = 0):
        self.items.nth(index).click()
        self.page.wait_for_load_state("networkidle")
