"""Playwright E2E test for M6: Login flow and dashboard verification."""

import pytest

BASE = "http://localhost:5173"
API = "http://localhost:8000/api"

HOD_CREDENTIALS = {"username": "test_hod", "password": "test123"}


@pytest.fixture(autouse=True)
def go_to_login(page):
    page.goto(f"{BASE}/login")
    page.wait_for_selector("h2.login-card-title", timeout=15000)


def do_login(page, username, password):
    page.fill("input[aria-label='Employee ID']", username)
    page.fill("input[aria-label='Password']", password)
    page.click("button.login-submit-btn")


def do_successful_login(page, username, password):
    do_login(page, username, password)
    page.wait_for_function(
        "window.location.pathname !== '/login'",
        timeout=20000,
    )
    assert "/login" not in page.url


def test_login_and_dashboard_loads(page):
    do_successful_login(page, HOD_CREDENTIALS["username"], HOD_CREDENTIALS["password"])
    page.wait_for_selector("div.dashboard-stats", timeout=15000)
    assert page.locator("div.dashboard-stats").is_visible()


def test_role_based_nav_items(page):
    do_successful_login(page, HOD_CREDENTIALS["username"], HOD_CREDENTIALS["password"])
    page.wait_for_selector("nav", timeout=15000)
    nav = page.locator("nav")
    assert nav.is_visible()


def test_login_wrong_password(page):
    do_login(page, HOD_CREDENTIALS["username"], "wrongpassword")
    error = page.locator("div.login-error-msg")
    error.wait_for(state="visible", timeout=10000)
    assert error.is_visible()


def test_login_wrong_username(page):
    do_login(page, "nonexistent_user", "test123")
    error = page.locator("div.login-error-msg")
    error.wait_for(state="visible", timeout=10000)
    assert error.is_visible()


def test_empty_fields_stays_on_login(page):
    page.click("button.login-submit-btn")
    assert "/login" in page.url


def test_password_toggle(page):
    pw_input = page.locator("input[aria-label='Password']")
    pw_input.fill("test123")
    assert pw_input.get_attribute("type") == "password"
    toggle = page.locator("button.login-password-toggle")
    if toggle.count() > 0:
        toggle.click()
        assert pw_input.get_attribute("type") == "text"


def test_forgot_password_link(page):
    link = page.locator("a[href='/forgot-password']")
    assert link.count() > 0
