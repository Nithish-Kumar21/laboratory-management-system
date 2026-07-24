"""
Comprehensive end-to-end test suite for the Chemical Request workflow.

Covers:
  1. Full role/status visibility matrix (Staff, HOD, Storekeeper)
  2. Staff submit flow (draft → submit → staff sees it)
  3. Storekeeper cannot see pending before HOD approval
  4. HOD post-approval visibility (active queue vs history)
  5. Mark-as-issued permission: only storekeeper, only when status=accepted
  6. Venue field pipeline: submit → save → return
"""
import pytest
from decimal import Decimal
from rest_framework import status
from django.utils import timezone
from django.db import connection
from inventory.models import AvailableChemical
from stock_request.models import StockRequest, StockRequestChemicalItem

CHEMICAL_NAME = "E2E Workflow Acid"
CLASS_NAME = "I B.Sc Chemistry"
VENUE = "M.Sc Chemistry Laboratory"

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _login(client, user, password="test123"):
    resp = client.post(
        "/api/users/login/",
        {"username": user.employee_id, "password": password},
    )
    token = resp.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return resp


def _create(client, **overrides):
    data = {
        "class_name": CLASS_NAME,
        "reason": "E2E test",
        "status": overrides.get("status_val", "draft"),
        "date": timezone.now().date().isoformat(),
        "day_order": "I",
        "hour": [1, 2],
        "purpose_type": "practical_lab",
        "experiment_name": "E2E Test Experiment",
        "chemical_items": [
            {"chemical_name": CHEMICAL_NAME, "quantity": "100.00"}
        ],
    }
    data.update(overrides)
    data.pop("status_val", None)
    return client.post("/api/stock_request/", data, format="json")


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
        defaults={
            "quantity": Decimal("5000.00"),
            "reorder_level": Decimal("100.00"),
            "unit": "ml",
        },
    )


# ---------------------------------------------------------------------------
# 1 — SUBMIT FLOW: Staff submits draft → sees it in own feed
# ---------------------------------------------------------------------------

class TestStaffSubmitFlow:
    """After Staff submits (draft → pending), the request must appear
    in the staff member's own feed."""

    def test_staff_sees_own_request_after_submit(self, api_client, staff_user):
        """Create draft, submit it, then list → must include the request."""
        _setup_inventory()
        _login(api_client, staff_user)

        create_resp = _create(api_client, status_val="draft")
        assert create_resp.status_code == status.HTTP_201_CREATED
        req_id = create_resp.data["id"]

        # Submit
        submit_resp = api_client.post(f"/api/stock_request/{req_id}/submit/")
        assert submit_resp.status_code == status.HTTP_200_OK

        # Staff default feed (all, excluding draft/completed)
        items = _list_requests(api_client, "all")
        ids = [r["id"] for r in items]
        assert req_id in ids, (
            f"Staff cannot see own submitted request (id={req_id}). Got ids: {ids}"
        )

    def test_staff_sees_own_request_with_no_status_param(self, api_client, staff_user):
        """Same as above but with no ?status param (default=all)."""
        _setup_inventory()
        _login(api_client, staff_user)

        create_resp = _create(api_client, status_val="draft")
        req_id = create_resp.data["id"]

        submit_resp = api_client.post(f"/api/stock_request/{req_id}/submit/")
        assert submit_resp.status_code == status.HTTP_200_OK

        items = _list_requests(api_client)
        ids = [r["id"] for r in items]
        assert req_id in ids, (
            f"Staff cannot see own submitted request (no status param). Got ids: {ids}"
        )

    def test_draft_not_in_staff_active_feed(self, api_client, staff_user):
        """Drafts should not appear in the staff active feed (all)."""
        _setup_inventory()
        _login(api_client, staff_user)

        create_resp = _create(api_client, status_val="draft")
        req_id = create_resp.data["id"]

        items = _list_requests(api_client, "all")
        ids = [r["id"] for r in items]
        assert req_id not in ids, "Draft should not appear in active feed"

    def test_draft_visible_in_staff_draft_feed(self, api_client, staff_user):
        """Drafts should appear when filtering by draft."""
        _setup_inventory()
        _login(api_client, staff_user)

        create_resp = _create(api_client, status_val="draft")
        req_id = create_resp.data["id"]

        items = _list_requests(api_client, "draft")
        ids = [r["id"] for r in items]
        assert req_id in ids, "Draft should appear in draft feed"


# ---------------------------------------------------------------------------
# 2 — STOREKEEPER: cannot see pending requests before HOD approval
# ---------------------------------------------------------------------------

class TestStorekeeperPendingExclusion:
    """Storekeeper must NOT see requests while they are pending."""

    def test_storekeeper_does_not_see_pending_default(self, api_client, staff_user, store_keeper_user):
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        _login(api_client, store_keeper_user)
        items = _list_requests(api_client)
        ids = [r["id"] for r in items]
        assert req_id not in ids, (
            f"Storekeeper sees pending request before HOD approval! id={req_id}"
        )

    def test_storekeeper_does_not_see_pending_with_all(self, api_client, staff_user, store_keeper_user):
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        _login(api_client, store_keeper_user)
        items = _list_requests(api_client, "all")
        ids = [r["id"] for r in items]
        assert req_id not in ids, (
            f"Storekeeper sees pending request with status=all! id={req_id}"
        )

    def test_storekeeper_does_not_see_draft(self, api_client, staff_user, store_keeper_user):
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="draft")
        req_id = create_resp.data["id"]

        _login(api_client, store_keeper_user)
        items = _list_requests(api_client)
        ids = [r["id"] for r in items]
        assert req_id not in ids, "Storekeeper sees staff draft (should not)"


# ---------------------------------------------------------------------------
# 3 — HOD POST-APPROVAL: request leaves active queue
# ---------------------------------------------------------------------------

class TestHODPostApprovalVisibility:
    """After HOD approves, the request must no longer appear in HOD's active
    pending queue. It SHOULD appear in HOD's 'accepted' history view."""

    def _make_accepted(self, api_client, staff_user, hod_user):
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        _login(api_client, hod_user)
        resp = api_client.post(f"/api/stock_request/{req_id}/accept/")
        assert resp.status_code == status.HTTP_200_OK
        return req_id

    def test_hod_pending_feed_excludes_accepted(self, api_client, staff_user, hod_user):
        """After approval, request must NOT be in HOD's pending feed."""
        req_id = self._make_accepted(api_client, staff_user, hod_user)

        _login(api_client, hod_user)
        items = _list_requests(api_client, "pending")
        ids = [r["id"] for r in items]
        assert req_id not in ids, (
            f"HOD still sees accepted request in pending feed. id={req_id}"
        )

    def test_hod_accepted_history_shows_request(self, api_client, staff_user, hod_user):
        """After approval, HOD can see the request via 'accepted' filter."""
        req_id = self._make_accepted(api_client, staff_user, hod_user)

        _login(api_client, hod_user)
        items = _list_requests(api_client, "accepted")
        ids = [r["id"] for r in items]
        assert req_id in ids, (
            f"HOD cannot see accepted request in accepted history. id={req_id}"
        )

    def test_hod_all_feed_shows_only_reviewed(self, api_client, staff_user, hod_user):
        """HOD ?status=all shows only requests they personally reviewed."""
        req_id = self._make_accepted(api_client, staff_user, hod_user)

        _login(api_client, hod_user)
        items = _list_requests(api_client, "all")
        ids = [r["id"] for r in items]
        assert req_id in ids, (
            f"HOD cannot see own reviewed accepted request in 'all' feed. id={req_id}"
        )


# ---------------------------------------------------------------------------
# 4 — MARK AS ISSUED PERMISSIONS
# ---------------------------------------------------------------------------

class TestMarkAsIssuedPermissions:
    """Storekeeper can only mark as issued when status=accepted,
    and only storekeeper/admin can perform this action."""

    def _make_accepted(self, api_client, staff_user, hod_user):
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        _login(api_client, hod_user)
        resp = api_client.post(f"/api/stock_request/{req_id}/accept/")
        assert resp.status_code == status.HTTP_200_OK
        return req_id

    def test_storekeeper_can_mark_as_issued_when_accepted(self, api_client, staff_user, hod_user, store_keeper_user):
        """Storekeeper CAN mark as issued when status=accepted."""
        req_id = self._make_accepted(api_client, staff_user, hod_user)

        _login(api_client, store_keeper_user)
        resp = api_client.post(f"/api/stock_request/{req_id}/mark_as_issued/")
        assert resp.status_code == status.HTTP_200_OK
        assert StockRequest.objects.get(id=req_id).status == "issued"

    def test_staff_cannot_mark_as_issued(self, api_client, staff_user, hod_user):
        """Staff cannot mark as issued (only storekeeper/admin)."""
        req_id = self._make_accepted(api_client, staff_user, hod_user)

        _login(api_client, staff_user)
        resp = api_client.post(f"/api/stock_request/{req_id}/mark_as_issued/")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_hod_cannot_mark_as_issued(self, api_client, staff_user, hod_user):
        """HOD cannot mark as issued (only storekeeper/admin)."""
        req_id = self._make_accepted(api_client, staff_user, hod_user)

        _login(api_client, hod_user)
        resp = api_client.post(f"/api/stock_request/{req_id}/mark_as_issued/")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_storekeeper_cannot_mark_as_issued_when_pending(self, api_client, staff_user, store_keeper_user):
        """Storekeeper CANNOT mark as issued when status=pending."""
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="pending")
        req_id = create_resp.data["id"]

        _login(api_client, store_keeper_user)
        resp = api_client.post(f"/api/stock_request/{req_id}/mark_as_issued/")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_storekeeper_cannot_mark_as_issued_when_draft(self, api_client, staff_user, store_keeper_user):
        """Storekeeper CANNOT mark as issued when status=draft."""
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="draft")
        req_id = create_resp.data["id"]

        _login(api_client, store_keeper_user)
        resp = api_client.post(f"/api/stock_request/{req_id}/mark_as_issued/")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_storekeeper_cannot_mark_as_issued_when_already_issued(self, api_client, staff_user, hod_user, store_keeper_user):
        """Storekeeper cannot re-issue (idempotent: returns 200 but no change)."""
        req_id = self._make_accepted(api_client, staff_user, hod_user)

        _login(api_client, store_keeper_user)
        api_client.post(f"/api/stock_request/{req_id}/mark_as_issued/")
        resp = api_client.post(f"/api/stock_request/{req_id}/mark_as_issued/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["data"]["message"] == "Already issued."


# ---------------------------------------------------------------------------
# 5 — VENUE FIELD PIPELINE
# ---------------------------------------------------------------------------

class TestVenueFieldPipeline:
    """Venue submitted in the form must be saved to the DB, returned by
    the API, and available on the detail endpoint.

    Since the stock_request model does NOT have a 'venue' field yet,
    this test suite will first confirm the break point, then after the
    fix, confirm the full pipeline works.
    """

    def _create_with_venue(self, client, venue=VENUE):
        return client.post(
            "/api/stock_request/",
            {
                "class_name": CLASS_NAME,
                "reason": "Venue test",
                "status": "draft",
                "date": timezone.now().date().isoformat(),
                "day_order": "I",
                "hour": [1, 2],
                "venue": venue,
                "purpose_type": "practical_lab",
                "experiment_name": "Venue Test Experiment",
                "chemical_items": [
                    {"chemical_name": CHEMICAL_NAME, "quantity": "50.00"}
                ],
            },
            format="json",
        )

    def test_venue_in_create_response(self, api_client, staff_user):
        """Venue must be returned in the create response."""
        _setup_inventory()
        _login(api_client, staff_user)
        resp = self._create_with_venue(api_client)
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data.get("venue") == VENUE, (
            f"Venue not in create response. Got: {resp.data}"
        )

    def test_venue_in_detail_response(self, api_client, staff_user):
        """Venue must be returned in the detail (retrieve) response."""
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = self._create_with_venue(api_client)
        req_id = create_resp.data["id"]

        detail = api_client.get(f"/api/stock_request/{req_id}/")
        assert detail.status_code == status.HTTP_200_OK
        assert detail.data.get("venue") == VENUE, (
            f"Venue not in detail response. Got: {detail.data}"
        )

    def test_venue_in_list_response(self, api_client, staff_user):
        """Venue must be returned in the list response."""
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = self._create_with_venue(api_client)
        req_id = create_resp.data["id"]

        items = _list_requests(api_client, "draft")
        match = [r for r in items if r["id"] == req_id]
        assert len(match) == 1, f"Request not found in draft list"
        assert match[0].get("venue") == VENUE, (
            f"Venue not in list response. Got: {match[0]}"
        )

    def test_venue_persisted_in_db(self, api_client, staff_user):
        """Venue must be persisted in the database."""
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = self._create_with_venue(api_client)
        req_id = create_resp.data["id"]

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT venue FROM stock_request WHERE id = %s", [req_id]
            )
            row = cursor.fetchone()
            assert row is not None, "Request not found in DB"
            assert row[0] == VENUE, (
                f"Venue not persisted in DB. Got: {row[0]}"
            )

    def test_venue_survives_submit(self, api_client, staff_user):
        """Venue must still be present after draft → submit (pending)."""
        _setup_inventory()
        _login(api_client, staff_user)
        create_resp = self._create_with_venue(api_client)
        req_id = create_resp.data["id"]

        api_client.post(f"/api/stock_request/{req_id}/submit/")

        detail = api_client.get(f"/api/stock_request/{req_id}/")
        assert detail.data.get("venue") == VENUE, (
            f"Venue lost after submit. Got: {detail.data.get('venue')}"
        )


# ---------------------------------------------------------------------------
# 6 — FULL WORKFLOW VISIBILITY TRANSITION
# ---------------------------------------------------------------------------

class TestFullWorkflowVisibility:
    """Trace a single request through the entire lifecycle and verify
    visibility at each stage for all three roles."""

    def test_full_lifecycle_visibility(self, api_client, staff_user, hod_user, store_keeper_user):
        _setup_inventory()

        # --- Stage 1: Draft (only Staff sees) ---
        _login(api_client, staff_user)
        create_resp = _create(api_client, status_val="draft")
        req_id = create_resp.data["id"]

        # Staff sees draft
        staff_items = [r["id"] for r in _list_requests(api_client, "draft")]
        assert req_id in staff_items

        # HOD does NOT see draft
        _login(api_client, hod_user)
        hod_items = [r["id"] for r in _list_requests(api_client, "pending")]
        assert req_id not in hod_items

        # Storekeeper does NOT see draft
        _login(api_client, store_keeper_user)
        sk_items = [r["id"] for r in _list_requests(api_client)]
        assert req_id not in sk_items

        # --- Stage 2: Pending (Staff sees, HOD sees, Storekeeper doesn't) ---
        _login(api_client, staff_user)
        api_client.post(f"/api/stock_request/{req_id}/submit/")

        # Staff sees pending
        staff_items = [r["id"] for r in _list_requests(api_client, "all")]
        assert req_id in staff_items

        # HOD sees pending
        _login(api_client, hod_user)
        hod_items = [r["id"] for r in _list_requests(api_client, "pending")]
        assert req_id in hod_items

        # Storekeeper does NOT see pending
        _login(api_client, store_keeper_user)
        sk_items = [r["id"] for r in _list_requests(api_client)]
        assert req_id not in sk_items

        # --- Stage 3: Accepted (Staff sees, HOD doesn't in pending queue, Storekeeper sees) ---
        _login(api_client, hod_user)
        api_client.post(f"/api/stock_request/{req_id}/accept/")

        # Staff sees accepted
        _login(api_client, staff_user)
        staff_items = [r["id"] for r in _list_requests(api_client, "all")]
        assert req_id in staff_items

        # HOD does NOT see in pending queue
        _login(api_client, hod_user)
        hod_pending = [r["id"] for r in _list_requests(api_client, "pending")]
        assert req_id not in hod_pending

        # HOD sees in accepted history
        hod_accepted = [r["id"] for r in _list_requests(api_client, "accepted")]
        assert req_id in hod_accepted

        # Storekeeper sees accepted
        _login(api_client, store_keeper_user)
        sk_items = [r["id"] for r in _list_requests(api_client)]
        assert req_id in sk_items

        # --- Stage 4: Issued (Staff sees, Storekeeper sees) ---
        _login(api_client, store_keeper_user)
        api_client.post(f"/api/stock_request/{req_id}/mark_as_issued/")

        _login(api_client, staff_user)
        staff_items = [r["id"] for r in _list_requests(api_client, "all")]
        assert req_id in staff_items

        _login(api_client, store_keeper_user)
        sk_items = [r["id"] for r in _list_requests(api_client)]
        assert req_id in sk_items
