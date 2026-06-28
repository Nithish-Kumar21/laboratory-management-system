"""Login tests for all user roles using Playwright."""

import pytest
import requests

BASE = "http://localhost:3000"
API = "http://localhost:8000/api"

USERS = {
    "hod":          {"username": "test_hod",           "password": "test123"},
    "staff":        {"username": "test_staff",          "password": "test123"},
    "store_keeper": {"username": "test_store_keeper",   "password": "test123"},
}


@pytest.fixture(autouse=True)
def go_to_login(page):
    page.goto(f"{BASE}/login")
    page.wait_for_selector("h2.login-card-title")


def do_login(page, username, password):
    page.fill("input[placeholder*='employee ID']", username)
    page.fill("input[placeholder='Enter password']", password)
    page.click("button.login-submit-btn")


def do_successful_login(page, username, password):
    """Login and wait for redirect away from /login (SPA-friendly)."""
    do_login(page, username, password)
    page.wait_for_function(
        "window.location.pathname !== '/login'",
        timeout=20000,
    )
    assert "/login" not in page.url


def test_login_hod(page):
    do_successful_login(page, USERS["hod"]["username"], USERS["hod"]["password"])


def test_login_staff(page):
    do_successful_login(page, USERS["staff"]["username"], USERS["staff"]["password"])


def test_login_store_keeper(page):
    do_successful_login(page, USERS["store_keeper"]["username"], USERS["store_keeper"]["password"])


def test_login_wrong_password(page):
    do_login(page, USERS["hod"]["username"], "wrongpassword")
    error = page.locator("div.login-error-msg")
    error.wait_for(state="visible", timeout=10000)
    assert error.is_visible()


def test_login_wrong_username(page):
    do_login(page, "nonexistent_user", "test123")
    error = page.locator("div.login-error-msg")
    error.wait_for(state="visible", timeout=10000)
    assert error.is_visible()


def test_login_empty_fields(page):
    page.click("button.login-submit-btn")
    assert "/login" in page.url


def test_password_toggle(page):
    pw_input = page.locator("input[placeholder='Enter password']")
    pw_input.fill("test123")
    assert pw_input.get_attribute("type") == "password"
    page.locator("button.login-password-toggle").click()
    assert pw_input.get_attribute("type") == "text"
    page.locator("button.login-password-toggle").click()
    assert pw_input.get_attribute("type") == "password"


def test_forgot_password_link(page):
    link = page.locator("a[href='/forgot-password']")
    assert link.count() > 0
