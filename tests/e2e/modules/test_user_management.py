"""
E2E Tests: User Management
Module: users (CRUD operations)
Covers: create user (HOD), RBAC enforcement, edit user, user listing
"""
import pytest
import time
from tests.e2e.conftest import BASE_URL, APIClient
from tests.e2e.page_objects import UserManagementPage, CreateUserPage

pytestmark = [pytest.mark.e2e, pytest.mark.user_mgmt]


# ---------------------------------------------------------------------------
# TC-USER-001: HOD can access user management
# ---------------------------------------------------------------------------
class TestUserManagementAccess:
    @pytest.mark.critical
    def test_hod_can_view_users_page(self, login_hod):
        """HOD sees the User Management page with user listing."""
        page = login_hod
        page.goto(f"{BASE_URL}/users")
        page.wait_for_load_state("networkidle")
        assert "users" in page.url
        # Should NOT redirect away (non-admin would redirect)
        assert not page.url.endswith("/login")

    @pytest.mark.critical
    def test_staff_cannot_access_users_page(self, login_staff):
        """Staff is redirected away from /users (adminOnly route)."""
        page = login_staff
        page.goto(f"{BASE_URL}/users")
        page.wait_for_load_state("networkidle")
        # ProtectedRoute with adminOnly redirects non-admin to /
        assert "users" not in page.url or page.url.endswith("/login")


# ---------------------------------------------------------------------------
# TC-USER-002: Create user flow
# ---------------------------------------------------------------------------
class TestCreateUser:
    @pytest.mark.high
    def test_hod_can_reach_create_user_page(self, login_hod):
        """HOD can navigate to user creation form."""
        page = login_hod
        page.goto(f"{BASE_URL}/users/create")
        page.wait_for_load_state("networkidle")
        assert "users/create" in page.url
        # Verify form fields exist
        assert page.locator('input').count() > 0

    @pytest.mark.high
    def test_create_staff_user_via_api(self, api_hod, db):
        """Creating a user via API (simulating UI submission) succeeds for HOD."""
        timestamp = int(time.time())
        r = api_hod.post("users/", json={
            "employee_id": f"E2E-{timestamp}",
            "full_name": f"Test User {timestamp}",
            "email": f"e2e_{timestamp}@test.com",
            "phone": f"+91{9000000000 + timestamp % 10000000}",
            "role": "staff",
            "degree": "bsc",
            "designation": "Lab Assistant",
            "password": "Test@1234",
        })
        assert r.status_code == 201, f"Create user failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("employee_id") == f"E2E-{timestamp}"

    @pytest.mark.high
    def test_staff_cannot_create_user_via_api(self, api_staff):
        """Staff role is rejected when attempting to create a user."""
        r = api_staff.post("users/", json={
            "employee_id": "SHOULD-FAIL",
            "full_name": "Should Fail",
            "email": "fail@test.com",
            "phone": "+919999999999",
            "role": "staff",
            "designation": "Test",
            "password": "Test@1234",
        })
        assert r.status_code in (403, 401), f"Expected 403, got {r.status_code}"


# ---------------------------------------------------------------------------
# TC-USER-003: Duplicate employee ID
# ---------------------------------------------------------------------------
class TestDuplicateUser:
    @pytest.mark.high
    def test_duplicate_employee_id_rejected(self, api_hod):
        """Creating a user with existing employee ID returns error."""
        r1 = api_hod.post("users/", json={
            "employee_id": "DUP-TEST",
            "full_name": "First User",
            "email": "dup1@test.com",
            "phone": "+919876543210",
            "role": "staff",
            "designation": "Test",
            "password": "Test@1234",
        })
        # Either created or already exists — then try duplicate
        r2 = api_hod.post("users/", json={
            "employee_id": "DUP-TEST",
            "full_name": "Second User",
            "email": "dup2@test.com",
            "phone": "+919876543211",
            "role": "staff",
            "designation": "Test",
            "password": "Test@1234",
        })
        assert r2.status_code == 400, f"Duplicate should be rejected, got {r2.status_code}"


# ---------------------------------------------------------------------------
# TC-USER-004: Invalid phone format
# ---------------------------------------------------------------------------
class TestInvalidPhone:
    @pytest.mark.medium
    def test_invalid_phone_format_rejected(self, api_hod):
        """User creation with invalid phone format is rejected."""
        r = api_hod.post("users/", json={
            "employee_id": "PHONE-TEST",
            "full_name": "Phone Test",
            "email": "phone@test.com",
            "phone": "12345",
            "role": "staff",
            "designation": "Test",
            "password": "Test@1234",
        })
        assert r.status_code == 400, f"Invalid phone should be rejected, got {r.status_code}"


# ---------------------------------------------------------------------------
# TC-USER-005: Current user profile
# ---------------------------------------------------------------------------
class TestUserProfile:
    @pytest.mark.medium
    def test_me_endpoint_returns_current_user(self, api_hod):
        """/users/me/ returns the authenticated user's profile."""
        r = api_hod.get("users/me/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("employee_id") == "test_hod"
        # Password must NOT be in the response
        assert "password" not in data
        assert "password_must_change" in data


# ---------------------------------------------------------------------------
# TC-USER-006: Edit user via UI
# ---------------------------------------------------------------------------
class TestEditUserUI:
    @pytest.mark.medium
    def test_hod_sees_user_list(self, login_hod):
        """HOD sees user listing with expected users."""
        page = login_hod
        page.goto(f"{BASE_URL}/users")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        # Should see at least the seeded users
        content = page.content()
        assert "test_hod" in content or "HOD" in content


# ---------------------------------------------------------------------------
# TC-USER-007: Adversarial — tampered JWT
# ---------------------------------------------------------------------------
class TestTamperedJWT:
    @pytest.mark.high
    def test_tampered_token_rejected(self, page):
        """Using a tampered JWT token results in redirect to login."""
        page.goto(f"{BASE_URL}/login")
        page.evaluate("""() => {
            localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiJ9.tampered.invalid');
            localStorage.setItem('refresh_token', 'eyJhbGciOiJIUzI1NiJ9.tampered.invalid');
            localStorage.setItem('user', JSON.stringify({role: 'hod', employee_id: 'test_hod'}));
        }""")
        page.goto(f"{BASE_URL}/inventory")
        page.wait_for_load_state("networkidle")
        # Should redirect to login or show error
        assert "login" in page.url or page.locator("[class*='error']").count() > 0


# ---------------------------------------------------------------------------
# TC-USER-008: Access token expiry handling
# ---------------------------------------------------------------------------
class TestTokenExpiry:
    @pytest.mark.medium
    def test_expired_token_redirects_to_login(self, page):
        """Expired access token triggers redirect to login."""
        page.goto(f"{BASE_URL}/login")
        page.evaluate("""() => {
            localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.expired');
            localStorage.setItem('refresh_token', 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.expired');
            localStorage.setItem('user', JSON.stringify({role: 'hod', employee_id: 'test_hod'}));
        }""")
        page.goto(f"{BASE_URL}/inventory")
        page.wait_for_load_state("networkidle")
        # With invalid tokens, should redirect to login
        assert "login" in page.url or page.evaluate("() => !!localStorage.getItem('access_token')") is False
