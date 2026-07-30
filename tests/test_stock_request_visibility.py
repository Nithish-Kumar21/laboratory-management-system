"""
End-to-end tests verifying chemical-request visibility behaviour across
Staff, HOD, and Storekeeper roles at every lifecycle stage.

Expected visibility rules:
  - PENDING:   Staff sees own ✓ | HOD sees (others') ✓ | Storekeeper ✗
  - APPROVED:  Staff sees own ✓ | HOD sees (own reviewed) | Storekeeper sees ✓
  - ISSUED:    Staff sees own ✓ | HOD sees (own reviewed) | Storekeeper sees ✓
  - REJECTED:  Staff sees own ✓ | HOD sees (own reviewed) | Storekeeper ✗

The "second-submission-auto-drafts" rule is also tested.
"""
import pytest
from decimal import Decimal
from rest_framework import status
from django.utils import timezone
from inventory.models import AvailableChemical
from stock_request.models import StockRequest, StockRequestChemicalItem

CHEMICAL_NAME = "Visibility Test Acid"
CLASS_NAME = "I B.Sc Chemistry"
REASON = "Visibility test"

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _login(client, user, password="test123"):
    resp = client.post("/api/users/login/", {"username": user.employee_id, "password": password})
    token = resp.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return resp


def _create(client, *, status_val="draft", chemical=None):
    chem = chemical or CHEMICAL_NAME
    return client.post(
        "/api/stock_request/",
        {
            "class_name": CLASS_NAME,
            "reason": REASON,
            "status": status_val,
            "date": timezone.now().date().isoformat(),
            "day_order": "I",
            "hour": [1, 2],
            "purpose_type": "practical_lab",
            "experiment_name": "Visibility Test",
            "chemical_items": [{"chemical_name": chem, "quantity": "100.00"}],
        },
        format="json",
    )


def _list_requests(client, status_param=None):
    url = "/api/stock_request/"
    if status_param is not None:
        url += f"?status={status_param}"
    resp = client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.data
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    if isinstance(data, list):
        return data
    return []


def _setup_inventory():
    AvailableChemical.objects.get_or_create(
        chemical_name=CHEMICAL_NAME,
        defaults={"quantity": Decimal("5000.00"), "reorder_level": Decimal("100.00"), "unit": "ml"},
    )


# ---------------------------------------------------------------------------
# 1 — PENDING status visibility
# ---------------------------------------------------------------------------

class TestPendingVisibility:
    """After Staff submits (status=pending), verify each role's feed."""

    def test_staff_sees_own_pending(self, api_client, staff_user):
        """Staff must always see their own pending request."""
        _setup_inventory()
        _login(api_client, staff_user)

        # Create directly as pending (simulates submit-from-form)
        create_resp = _create(api_client, status_val="pending")
        assert create_resp.status_code == status.HTTP_201_CREATED
        req_id = create_resp.data["id"]

        # Staff list with ?status=all must include the pending request
        items = _list_requests(api_client, "all")
        ids = [r["id"] for r in items]
        assert req_id in ids, f"Staff cannot see own pending request (id={req_id}). Got ids: {ids}"

    def test_staff_sees_own_pending_default_param(self, api_client, staff_user):
        """Staff list with no status param (default=all) must include pending."""
        _setup_inventory()
        _login(api_client, staff_user)

        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        # No status param → backend treats as 'all' for staff
        items = _list_requests(api_client)
        ids = [r["id"] for r in items]
        assert req_id in ids, f"Staff cannot see own pending request with default param. Got ids: {ids}"

    def test_hod_sees_pending_from_others(self, api_client, staff_user, hod_user):
        """HOD must see other users' pending requests."""
        _setup_inventory()

        # Staff creates pending request
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        # HOD list (default sends status=pending)
        _login(api_client, hod_user)
        items = _list_requests(api_client, "pending")
        ids = [r["id"] for r in items]
        assert req_id in ids, f"HOD cannot see pending request from staff. Got ids: {ids}"

    def test_hod_does_not_see_own_pending(self, api_client, hod_user):
        """HOD should NOT see their own pending requests (only others')."""
        _setup_inventory()
        _login(api_client, hod_user)

        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        # HOD default list
        items = _list_requests(api_client, "pending")
        ids = [r["id"] for r in items]
        assert req_id not in ids, f"HOD can see own pending request (should not). id={req_id}"

    def test_storekeeper_does_not_see_pending(self, api_client, staff_user, store_keeper_user):
        """Storekeeper must NOT see requests before HOD approval."""
        _setup_inventory()

        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        # Storekeeper list (no status param)
        _login(api_client, store_keeper_user)
        items = _list_requests(api_client)
        ids = [r["id"] for r in items]
        assert req_id not in ids, (
            f"Storekeeper can see pending request before HOD approval! id={req_id}. "
            f"Got ids: {ids}"
        )

    def test_storekeeper_does_not_see_pending_with_all(self, api_client, staff_user, store_keeper_user):
        """Storekeeper with ?status=all must NOT see pending requests."""
        _setup_inventory()

        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        _login(api_client, store_keeper_user)
        items = _list_requests(api_client, "all")
        ids = [r["id"] for r in items]
        assert req_id not in ids, (
            f"Storekeeper can see pending request with status=all! id={req_id}. Got ids: {ids}"
        )


# ---------------------------------------------------------------------------
# 2 — APPROVED (accepted) status visibility
# ---------------------------------------------------------------------------

class TestApprovedVisibility:
    """After HOD approves (status=accepted), verify each role's feed."""

    def _make_accepted(self, api_client, staff_user, hod_user):
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        _login(api_client, hod_user)
        resp = api_client.post(f"/api/stock_request/{req_id}/accept/")
        assert resp.status_code == status.HTTP_200_OK
        return req_id

    def test_staff_sees_own_accepted(self, api_client, staff_user, hod_user):
        """Staff must see their own accepted request."""
        req_id = self._make_accepted(api_client, staff_user, hod_user)

        _login(api_client, staff_user)
        items = _list_requests(api_client, "all")
        ids = [r["id"] for r in items]
        assert req_id in ids, f"Staff cannot see own accepted request. Got ids: {ids}"

    def test_hod_does_not_see_accepted_in_default_feed(self, api_client, staff_user, hod_user):
        """HOD default feed (pending) must NOT show accepted requests."""
        req_id = self._make_accepted(api_client, staff_user, hod_user)

        _login(api_client, hod_user)
        items = _list_requests(api_client, "pending")
        ids = [r["id"] for r in items]
        assert req_id not in ids, f"HOD still sees accepted request in pending feed. id={req_id}"

    def test_hod_sees_own_reviewed_accepted(self, api_client, staff_user, hod_user):
        """HOD ?status=accepted should show requests they personally approved."""
        req_id = self._make_accepted(api_client, staff_user, hod_user)

        _login(api_client, hod_user)
        items = _list_requests(api_client, "accepted")
        ids = [r["id"] for r in items]
        assert req_id in ids, f"HOD cannot see own reviewed accepted request. Got ids: {ids}"

    def test_storekeeper_sees_accepted(self, api_client, staff_user, hod_user, store_keeper_user):
        """Storekeeper must see accepted requests."""
        req_id = self._make_accepted(api_client, staff_user, hod_user)

        _login(api_client, store_keeper_user)
        items = _list_requests(api_client)
        ids = [r["id"] for r in items]
        assert req_id in ids, f"Storekeeper cannot see accepted request. Got ids: {ids}"


# ---------------------------------------------------------------------------
# 3 — ISSUED status visibility
# ---------------------------------------------------------------------------

class TestIssuedVisibility:
    """After Storekeeper issues chemicals (status=issued)."""

    def _make_issued(self, api_client, staff_user, hod_user, store_keeper_user):
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        _login(api_client, hod_user)
        api_client.post(f"/api/stock_request/{req_id}/accept/")

        _login(api_client, store_keeper_user)
        resp = api_client.post(f"/api/stock_request/{req_id}/mark_as_issued/")
        assert resp.status_code == status.HTTP_200_OK
        return req_id

    def test_staff_sees_own_issued(self, api_client, staff_user, hod_user, store_keeper_user):
        req_id = self._make_issued(api_client, staff_user, hod_user, store_keeper_user)

        _login(api_client, staff_user)
        items = _list_requests(api_client, "all")
        ids = [r["id"] for r in items]
        assert req_id in ids, f"Staff cannot see own issued request. Got ids: {ids}"

    def test_storekeeper_sees_issued(self, api_client, staff_user, hod_user, store_keeper_user):
        req_id = self._make_issued(api_client, staff_user, hod_user, store_keeper_user)

        _login(api_client, store_keeper_user)
        items = _list_requests(api_client)
        ids = [r["id"] for r in items]
        assert req_id in ids, f"Storekeeper cannot see issued request. Got ids: {ids}"

    def test_hod_default_feed_excludes_issued(self, api_client, staff_user, hod_user, store_keeper_user):
        req_id = self._make_issued(api_client, staff_user, hod_user, store_keeper_user)

        _login(api_client, hod_user)
        items = _list_requests(api_client, "pending")
        ids = [r["id"] for r in items]
        assert req_id not in ids, f"HOD still sees issued request in pending feed. id={req_id}"


# ---------------------------------------------------------------------------
# 4 — REJECTED status visibility
# ---------------------------------------------------------------------------

class TestRejectedVisibility:
    """After HOD rejects (status=rejected)."""

    def _make_rejected(self, api_client, staff_user, hod_user):
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        _login(api_client, hod_user)
        resp = api_client.post(
            f"/api/stock_request/{req_id}/reject/",
            {"rejection_reason": "Test rejection"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        return req_id

    def test_staff_sees_own_rejected(self, api_client, staff_user, hod_user):
        req_id = self._make_rejected(api_client, staff_user, hod_user)

        _login(api_client, staff_user)
        items = _list_requests(api_client, "all")
        ids = [r["id"] for r in items]
        assert req_id in ids, f"Staff cannot see own rejected request. Got ids: {ids}"

    def test_hod_sees_own_reviewed_rejected(self, api_client, staff_user, hod_user):
        req_id = self._make_rejected(api_client, staff_user, hod_user)

        _login(api_client, hod_user)
        items = _list_requests(api_client, "rejected")
        ids = [r["id"] for r in items]
        assert req_id in ids, f"HOD cannot see own reviewed rejected request. Got ids: {ids}"

    def test_storekeeper_does_not_see_rejected(self, api_client, staff_user, hod_user, store_keeper_user):
        req_id = self._make_rejected(api_client, staff_user, hod_user)

        _login(api_client, store_keeper_user)
        items = _list_requests(api_client)
        ids = [r["id"] for r in items]
        assert req_id not in ids, f"Storekeeper can see rejected request. id={req_id}"


# ---------------------------------------------------------------------------
# 5 — Second-submission auto-drafts rule
# ---------------------------------------------------------------------------

class TestSecondSubmissionAutoDrafts:
    """When staff already has an active (pending/accepted/issued/reported)
    request, creating a second request should auto-save to 'draft' and
    be visible only to that staff member."""

    def test_active_request_blocks_direct_pending_create(self, api_client, staff_user):
        """Creating directly as pending while an active request exists
        should be rejected by perform_create."""
        _setup_inventory()
        _login(api_client, staff_user)

        # First request — pending
        resp1 = _create(api_client, status_val="pending")
        assert resp1.status_code == status.HTTP_201_CREATED

        # Second request — should be rejected (active request exists)
        resp2 = _create(api_client, status_val="pending")
        assert resp2.status_code == status.HTTP_400_BAD_REQUEST

    def test_second_request_as_draft_succeeds(self, api_client, staff_user):
        """Staff can save a second request as draft while active request exists."""
        _setup_inventory()
        _login(api_client, staff_user)

        resp1 = _create(api_client, status_val="pending")
        assert resp1.status_code == status.HTTP_201_CREATED

        # Second as draft — should succeed
        resp2 = _create(api_client, status_val="draft")
        assert resp2.status_code == status.HTTP_201_CREATED
        assert resp2.data["status"] == "draft"

    def test_draft_only_visible_to_owner(self, api_client, staff_user, hod_user, store_keeper_user):
        """A staff member's draft should only appear in their own drafts feed,
        never in HOD or Storekeeper feeds."""
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="draft")
        req_id = create_resp.data["id"]

        # Staff drafts
        _login(api_client, staff_user)
        staff_items = _list_requests(api_client, "draft")
        staff_ids = [r["id"] for r in staff_items]
        assert req_id in staff_ids, "Staff cannot see own draft"

        # HOD should NOT see it
        _login(api_client, hod_user)
        hod_items = _list_requests(api_client, "pending")
        hod_ids = [r["id"] for r in hod_items]
        assert req_id not in hod_ids, "HOD can see staff draft (should not)"

        # Storekeeper should NOT see it
        _login(api_client, store_keeper_user)
        sk_items = _list_requests(api_client)
        sk_ids = [r["id"] for r in sk_items]
        assert req_id not in sk_ids, "Storekeeper can see staff draft (should not)"


# ---------------------------------------------------------------------------
# 6 — Cross-role isolation
# ---------------------------------------------------------------------------

class TestCrossRoleIsolation:
    """Multiple staff members' requests are properly isolated."""

    def test_staff_a_does_not_see_staff_b_requests(self, api_client, staff_user, hod_user, db):
        _setup_inventory()
        from django.contrib.auth import get_user_model
        User = get_user_model()
        staff_b = User.objects.create_user(
            employee_id="staff_b", email="b@test.com", password="test123",
            role="staff", full_name="Staff B", phone="+919999999995",
            designation="Staff", department="B.Sc Chemistry",
        )

        # Staff A creates
        _login(api_client, staff_user)
        resp_a = _create(api_client, status_val="pending")
        id_a = resp_a.data["id"]

        # Staff B creates
        _login(api_client, staff_b)
        resp_b = _create(api_client, status_val="pending")
        id_b = resp_b.data["id"]

        # Staff A list
        _login(api_client, staff_user)
        items = _list_requests(api_client, "all")
        ids = [r["id"] for r in items]
        assert id_a in ids
        assert id_b not in ids, "Staff A can see Staff B's request"

        # Staff B list
        _login(api_client, staff_b)
        items = _list_requests(api_client, "all")
        ids = [r["id"] for r in items]
        assert id_b in ids
        assert id_a not in ids, "Staff B can see Staff A's request"
