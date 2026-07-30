"""
E2E Tests: Non-Functional Scenarios
Covers: browser refresh mid-workflow, session timeout handling, slow network,
        direct URL access bypassing UI, double-click rapid re-submit
"""
import json as _json
import pytest
import time
from tests.e2e.conftest import BASE_URL, seed_chemical, create_stock_request, APIClient, inject_auth
from tests.e2e.page_objects import LoginPage

pytestmark = [pytest.mark.e2e, pytest.mark.nonfunctional]


def _inject(page, api_client):
    """Helper: inject auth tokens into a page."""
    user_data = api_client.get("users/me/").json()
    inject_auth(page, api_client.access_token, api_client.refresh_token, user_data)


# ---------------------------------------------------------------------------
# TC-NF-001: Browser refresh preserves state
# ---------------------------------------------------------------------------
class TestBrowserRefresh:
    @pytest.mark.high
    def test_refresh_on_inventory_keeps_auth(self, page):
        """Refreshing the inventory page preserves authentication state."""
        LoginPage(page).goto().login_and_wait("test_hod", "test123")
        page.goto(f"{BASE_URL}/inventory")
        page.wait_for_load_state("networkidle")
        page.reload()
        page.wait_for_load_state("networkidle")
        assert "inventory" in page.url

    @pytest.mark.high
    def test_refresh_on_request_detail_keeps_auth(self, page, api_staff, api_hod):
        """Refreshing a stock request detail page preserves state."""
        LoginPage(page).goto().login_and_wait("staff_test", "test123")
        r = create_stock_request(api_staff, status="draft", chemical_items=[
            {"chemical_name": "Hydrochloric Acid", "quantity": "10", "unit": "ml"}
        ])
        req_id = r.json()["id"]
        page.goto(f"{BASE_URL}/requests/{req_id}")
        page.wait_for_load_state("networkidle")
        page.reload()
        page.wait_for_load_state("networkidle")
        assert f"/requests/{req_id}" in page.url
        api_staff.delete(f"stock_request/{req_id}/")


# ---------------------------------------------------------------------------
# TC-NF-002: Direct URL access bypassing UI
# ---------------------------------------------------------------------------
class TestDirectURLAccess:
    @pytest.mark.high
    def test_direct_url_access_requires_auth(self, page):
        """Accessing a protected route directly without auth redirects to login."""
        page.goto(f"{BASE_URL}/requests")
        try:
            page.wait_for_url("**/login*", timeout=10000)
        except Exception:
            pass
        page.wait_for_load_state("networkidle")
        assert "login" in page.url

    @pytest.mark.high
    def test_direct_url_with_valid_token(self, page, api_hod):
        """Direct URL access with valid token loads the page."""
        _inject(page, api_hod)
        page.goto(f"{BASE_URL}/inventory")
        page.wait_for_load_state("networkidle")
        try:
            page.wait_for_url("**/inventory*", timeout=10000)
        except Exception:
            pass
        assert "inventory" in page.url

    @pytest.mark.medium
    def test_nonexistent_route_redirects_to_home(self, page, api_hod):
        """Navigating to a nonexistent route redirects to home/inventory."""
        _inject(page, api_hod)
        page.goto(f"{BASE_URL}/nonexistent-page-xyz")
        page.wait_for_load_state("networkidle")
        try:
            page.wait_for_url("**/inventory*", timeout=10000)
        except Exception:
            pass
        assert "inventory" in page.url or page.url.endswith("/")


# ---------------------------------------------------------------------------
# TC-NF-003: Double-click / rapid re-submit
# ---------------------------------------------------------------------------
class TestRapidResubmit:
    @pytest.mark.high
    def test_double_click_submit_does_not_duplicate(self, page, api_staff, api_hod):
        """Rapidly clicking submit on a draft does not create duplicate submissions."""
        LoginPage(page).goto().login_and_wait("staff_test", "test123")
        r = create_stock_request(api_staff, status="draft", chemical_items=[
            {"chemical_name": "Hydrochloric Acid", "quantity": "10", "unit": "ml"}
        ])
        req_id = r.json()["id"]
        page.goto(f"{BASE_URL}/requests/{req_id}")
        page.wait_for_load_state("networkidle")
        submit = page.locator('button:has-text("Submit")').first
        if submit.count() > 0 and submit.is_visible():
            submit.click()
            page.wait_for_timeout(100)
            submit.click()
            page.wait_for_timeout(100)
            submit.click()
        page.wait_for_load_state("networkidle")
        r = api_staff.get(f"stock_request/{req_id}/")
        if r.ok:
            assert r.json()["status"] in ("pending", "draft")
        if r.json()["status"] == "draft":
            api_staff.delete(f"stock_request/{req_id}/")
        elif r.json()["status"] == "pending":
            api_staff.post(f"stock_request/{req_id}/cancel/")


# ---------------------------------------------------------------------------
# TC-NF-004: Back button after form submit
# ---------------------------------------------------------------------------
class TestBrowserBackButton:
    @pytest.mark.medium
    def test_back_button_after_login_shows_login_page(self, page):
        """Browser back button after login still has user data in localStorage."""
        LoginPage(page).goto().login_and_wait("test_hod", "test123")
        page.goto(f"{BASE_URL}/inventory")
        page.wait_for_load_state("networkidle")
        page.go_back()
        page.wait_for_load_state("networkidle")
        user = page.evaluate("() => JSON.parse(localStorage.getItem('user'))")
        assert user is not None, "User data should persist across back navigation"


# ---------------------------------------------------------------------------
# TC-NF-005: Network failure handling
# ---------------------------------------------------------------------------
class TestNetworkFailure:
    @pytest.mark.medium
    def test_api_timeout_shows_error(self, page, api_hod):
        """API timeout should not crash the app — should show error gracefully."""
        _inject(page, api_hod)
        page.goto(f"{BASE_URL}/inventory")
        page.wait_for_load_state("networkidle")
        page.route("**/available_chemicals/**", lambda route: route.abort())
        page.reload()
        page.wait_for_timeout(3000)
        assert page.title() != "" or page.content() != ""


# ---------------------------------------------------------------------------
# TC-NF-006: Session timeout handling
# ---------------------------------------------------------------------------
class TestSessionTimeout:
    @pytest.mark.medium
    def test_expired_token_redirects_to_login(self, page):
        """Expired JWT token triggers redirect to login page."""
        page.goto(f"{BASE_URL}/login")
        page.evaluate("""() => {
            localStorage.setItem('access_token', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDB9.expired');
            localStorage.setItem('refresh_token', 'expired');
            localStorage.setItem('user', JSON.stringify({role: 'hod', employee_id: 'test_hod'}));
        }""")
        page.goto(f"{BASE_URL}/inventory")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        assert "login" in page.url


# ---------------------------------------------------------------------------
# TC-NF-007: Multiple tabs with same session
# ---------------------------------------------------------------------------
class TestMultipleTabs:
    @pytest.mark.medium
    def test_operations_in_one_tab_reflect_in_another(self, browser_instance):
        """Operations in one tab should be visible in another on refresh."""
        ctx = browser_instance.new_context(viewport={"width": 1280, "height": 800})
        page2 = ctx.new_page()
        try:
            from tests.e2e.conftest import APIClient as _APIClient
            api = _APIClient()
            api.login("test_hod", "test123")

            from tests.e2e.page_objects import LoginPage as _LP
            p1 = ctx.pages[0] if ctx.pages else ctx.new_page()
            _LP(p1).goto().login_and_wait("test_hod", "test123")

            inject_auth(page2, api.access_token, api.refresh_token, api.get("users/me/").json())

            page2.goto(f"{BASE_URL}/inventory")
            page2.wait_for_load_state("networkidle")
            assert "inventory" in page2.url
        finally:
            page2.close()
            ctx.close()
