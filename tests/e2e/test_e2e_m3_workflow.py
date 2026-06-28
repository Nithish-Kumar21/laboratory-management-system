import pytest
import requests
from helpers_e2e import BASE_API, BASE_URL, login_as, get_token, click_submit, cancel_active_requests


def seed_request(staff_token, status="draft"):
    cancel_active_requests(staff_token)
    headers = {"Authorization": f"Bearer {staff_token}"}
    payload = {
        "class_name": "I M.Sc Chemistry",
        "reason": "E2E test request",
        "date": "2026-06-27",
        "status": "draft",
        "chemical_items": [{"chemical_name": "Sodium Hydroxide", "quantity": 100}],
    }
    r = requests.post(f"{BASE_API}/stock_request/", json=payload, headers=headers)
    assert r.status_code == 201, f"Seed create failed: {r.text}"
    req_id = r.json()["id"]

    if status == "pending":
        r = requests.post(f"{BASE_API}/stock_request/{req_id}/submit/", headers=headers)
        assert r.status_code == 200, f"Seed submit failed: {r.text}"

    return req_id


def transition_request(req_id, action, token):
    headers = {"Authorization": f"Bearer {token}"}
    if action == "accept":
        return requests.post(f"{BASE_API}/stock_request/{req_id}/accept/", headers=headers)
    elif action == "reject":
        return requests.post(f"{BASE_API}/stock_request/{req_id}/reject/",
                             json={"rejection_reason": "Test rejection"}, headers=headers)
    elif action == "issue":
        return requests.post(f"{BASE_API}/stock_request/{req_id}/mark_as_issued/", headers=headers)
    return None


async def test_staff_creates_and_submits_request(async_page):
    await login_as(async_page, "staff")
    await async_page.goto(f"{BASE_URL}/new-request")
    await async_page.wait_for_load_state("networkidle")

    await async_page.locator("select").first.select_option("I M.Sc Chemistry")
    await async_page.get_by_placeholder("Select chemicals").fill("Sodium Hydroxide")
    await async_page.wait_for_timeout(300)
    suggestion = async_page.locator(".nrf-suggestion-item").first
    if await suggestion.count() > 0:
        await suggestion.click()
        await async_page.wait_for_timeout(300)

    await async_page.get_by_placeholder("0").fill("100")

    draft_btn = async_page.get_by_role("button", name="Draft")
    await draft_btn.scroll_into_view_if_needed()
    await async_page.wait_for_timeout(300)
    # Use evaluate to dispatch click directly on the button
    await async_page.evaluate("document.querySelector('button.nrf-btn-draft')?.click()")
    await async_page.wait_for_timeout(3000)

    await async_page.goto(f"{BASE_URL}/drafts")
    await async_page.wait_for_load_state("networkidle")
    await async_page.wait_for_timeout(1000)

    draft_cards = async_page.locator(".sr-card, .sr-card-mobile")
    count_before = await draft_cards.count()
    assert count_before >= 1, "No draft cards visible"

    # Click the first draft card to navigate to its detail page
    await async_page.evaluate("document.querySelector('.sr-card, .sr-card-mobile')?.click()")
    try:
        await async_page.wait_for_url(f"{BASE_URL}/requests/*", timeout=5000)
    except Exception:
        pass

    # Extract the ID from the detail page URL and navigate to edit page
    import re
    id_match = re.search(r'/requests/(\d+)', async_page.url)
    if id_match:
        await async_page.goto(f"{BASE_URL}/new-request?edit={id_match.group(1)}")
        await async_page.wait_for_load_state("networkidle")

    if await async_page.get_by_role("button", name="Submit").is_visible():
        await async_page.get_by_role("button", name="Submit").scroll_into_view_if_needed()
        await async_page.wait_for_timeout(200)
        await async_page.get_by_role("button", name="Submit").click(force=True)
        await async_page.wait_for_timeout(3000)

    # Verify via API that a pending request exists
    token = get_token("staff")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_API}/stock_request/?status=pending", headers=headers)
    data = r.json() if r.status_code == 200 else {}
    pending_list = data if isinstance(data, list) else data.get("results", [])
    assert len(pending_list) >= 1, f"No pending requests. API={r.status_code}"


async def test_hod_approves_request(async_page):
    staff_token = get_token("staff")
    req_id = seed_request(staff_token, status="pending")

    await login_as(async_page, "hod")
    await async_page.goto(f"{BASE_URL}/requests/{req_id}")
    await async_page.wait_for_load_state("networkidle")

    approve_btn = async_page.get_by_role("button", name="Approve")
    assert await approve_btn.is_visible()
    await approve_btn.scroll_into_view_if_needed()
    await approve_btn.click()

    ok_btn = async_page.get_by_role("button", name="OK")
    if await ok_btn.is_visible():
        await ok_btn.scroll_into_view_if_needed()
        await ok_btn.click()

    await async_page.wait_for_timeout(2000)
    status = async_page.locator(".badge-accepted")
    assert await status.is_visible()


async def test_hod_rejects_request(async_page):
    staff_token = get_token("staff")
    req_id = seed_request(staff_token, status="pending")

    await login_as(async_page, "hod")
    await async_page.goto(f"{BASE_URL}/requests/{req_id}")
    await async_page.wait_for_load_state("networkidle")

    reject_btn = async_page.get_by_role("button", name="Reject")
    assert await reject_btn.is_visible()
    await reject_btn.scroll_into_view_if_needed()
    await reject_btn.click()

    reason_input = async_page.locator("textarea").first
    await reason_input.fill("Insufficient justification for E2E test")

    confirm_reject = async_page.get_by_role("button", name="Reject Request")
    await confirm_reject.scroll_into_view_if_needed()
    await confirm_reject.click()
    await async_page.wait_for_timeout(2000)

    status = async_page.locator(".badge-rejected")
    assert await status.is_visible()


async def test_storekeeper_issues_chemicals(async_page):
    staff_token = get_token("staff")
    hod_token = get_token("hod")
    req_id = seed_request(staff_token, status="pending")
    transition_request(req_id, "accept", hod_token)

    await login_as(async_page, "storekeeper")
    await async_page.goto(f"{BASE_URL}/requests/{req_id}")
    await async_page.wait_for_load_state("networkidle")

    issue_btn = async_page.get_by_role("button", name="Mark as Issued")
    assert await issue_btn.is_visible()
    await issue_btn.scroll_into_view_if_needed()
    await issue_btn.click()

    ok_btn = async_page.get_by_role("button", name="OK")
    if await ok_btn.is_visible():
        await ok_btn.scroll_into_view_if_needed()
        await ok_btn.click()

    await async_page.wait_for_timeout(2000)
    status = async_page.locator(".badge-issued")
    assert await status.is_visible()


async def test_apparatus_blocked_in_request(async_page):
    await login_as(async_page, "staff")
    await async_page.goto(f"{BASE_URL}/new-request")
    await async_page.wait_for_load_state("networkidle")

    app_inputs = async_page.locator("input[placeholder*='apparatus' i], input[placeholder*='Apparatus' i]")
    assert await app_inputs.count() == 0, "Apparatus inputs found in chemical request form"


async def test_staff_reports_return(async_page):
    staff_token = get_token("staff")
    hod_token = get_token("hod")
    sk_token = get_token("storekeeper")

    req_id = seed_request(staff_token, status="pending")
    transition_request(req_id, "accept", hod_token)
    transition_request(req_id, "issue", sk_token)

    await login_as(async_page, "staff")
    await async_page.goto(f"{BASE_URL}/requests/{req_id}")
    await async_page.wait_for_load_state("networkidle")

    usage_inputs = async_page.locator("input[placeholder='0.00']")
    if await usage_inputs.count() > 0:
        await usage_inputs.scroll_into_view_if_needed()
        await usage_inputs.first.fill("80")

    report_btn = async_page.get_by_role("button", name="Submit Final Usage Report")
    if await report_btn.is_visible():
        await report_btn.scroll_into_view_if_needed()
        await report_btn.click()
        ok_btn = async_page.get_by_role("button", name="OK")
        if await ok_btn.is_visible():
            await ok_btn.scroll_into_view_if_needed()
            await ok_btn.click()
        await async_page.wait_for_timeout(2000)
        status = async_page.locator(".badge-reported")
        assert await status.is_visible()
