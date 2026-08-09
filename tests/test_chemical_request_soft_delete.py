"""
Tests for chemical request soft-delete behaviour.

Soft delete is implemented as a status change to 'cancelled' (the request
record stays in the DB for audit/history) combined with server-side filtering
that hides 'cancelled' requests from every role's feed.

Covered:
  - Storekeeper can soft-delete a request
  - Soft-deleted requests disappear from Staff, HOD and Storekeeper feeds
  - Soft-deleted requests cannot be retrieved (404)
  - HOD cannot delete requests (403)
  - Completed requests cannot be deleted (400)
"""
import pytest
from decimal import Decimal
from rest_framework import status
from django.utils import timezone
from inventory.models import AvailableChemical
from stock_request.models import StockRequest

CHEMICAL_NAME = "Soft Delete Test Acid"

pytestmark = pytest.mark.django_db


def _login(client, user, password="test123"):
    resp = client.post("/api/users/login/", {"username": user.employee_id, "password": password})
    token = resp.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return resp


def _create(client, *, status_val="pending"):
    resp = client.post(
        "/api/stock_request/",
        {
            "class_name": "I B.Sc Chemistry",
            "reason": "Soft delete test",
            "date": timezone.now().date().isoformat(),
            "day_order": "I",
            "hour": [1, 2],
            "purpose_type": "practical_lab",
            "experiment_name": "Soft Delete Test",
            "chemical_items": [{"chemical_name": CHEMICAL_NAME, "quantity": "100.00"}],
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED, resp.data
    req_id = resp.data["id"]
    submit_resp = client.post(f"/api/stock_request/{req_id}/submit/")
    assert submit_resp.status_code == status.HTTP_200_OK, submit_resp.data
    return resp


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


class TestSoftDelete:
    def test_storekeeper_can_soft_delete_pending(self, api_client, staff_user, store_keeper_user):
        _setup_inventory()
        _login(api_client, staff_user)
        req_id = _create(api_client).data["id"]

        _login(api_client, store_keeper_user)
        resp = api_client.delete(f"/api/stock_request/{req_id}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT

        obj = StockRequest.objects.get(id=req_id)
        assert obj.status == "cancelled"

    def test_deleted_hidden_from_all_feeds(self, api_client, staff_user, hod_user, store_keeper_user):
        _setup_inventory()
        _login(api_client, staff_user)
        req_id = _create(api_client).data["id"]

        # HOD accepts so the storekeeper feed shows the request
        _login(api_client, hod_user)
        assert api_client.post(f"/api/stock_request/{req_id}/accept/").status_code == status.HTTP_200_OK

        # Storekeeper sees it in their feed before deletion
        _login(api_client, store_keeper_user)
        ids = [r["id"] for r in _list_requests(api_client)]
        assert req_id in ids

        # Soft delete it
        assert api_client.delete(f"/api/stock_request/{req_id}/").status_code == status.HTTP_204_NO_CONTENT

        # Hidden from storekeeper feed
        ids = [r["id"] for r in _list_requests(api_client)]
        assert req_id not in ids

        # Hidden from HOD feed
        _login(api_client, hod_user)
        ids = [r["id"] for r in _list_requests(api_client, "all")]
        assert req_id not in ids

        # Hidden from staff feed
        _login(api_client, staff_user)
        ids = [r["id"] for r in _list_requests(api_client, "all")]
        assert req_id not in ids

    def test_deleted_retrieve_returns_404(self, api_client, staff_user, store_keeper_user):
        _setup_inventory()
        _login(api_client, staff_user)
        req_id = _create(api_client).data["id"]

        _login(api_client, store_keeper_user)
        assert api_client.delete(f"/api/stock_request/{req_id}/").status_code == status.HTTP_204_NO_CONTENT

        _login(api_client, staff_user)
        resp = api_client.get(f"/api/stock_request/{req_id}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_hod_cannot_delete(self, api_client, staff_user, hod_user):
        _setup_inventory()
        _login(api_client, staff_user)
        req_id = _create(api_client).data["id"]

        _login(api_client, hod_user)
        resp = api_client.delete(f"/api/stock_request/{req_id}/")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

        assert StockRequest.objects.get(id=req_id).status == "pending"

    def test_completed_cannot_be_deleted(self, api_client, staff_user, store_keeper_user):
        _setup_inventory()
        _login(api_client, staff_user)
        req_id = _create(api_client).data["id"]

        StockRequest.objects.filter(id=req_id).update(status="completed")

        _login(api_client, store_keeper_user)
        resp = api_client.delete(f"/api/stock_request/{req_id}/")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

        assert StockRequest.objects.get(id=req_id).status == "completed"

    def test_issued_cannot_be_deleted(self, api_client, staff_user, hod_user, store_keeper_user):
        _setup_inventory()
        _login(api_client, staff_user)
        req_id = _create(api_client).data["id"]

        _login(api_client, hod_user)
        assert api_client.post(f"/api/stock_request/{req_id}/accept/").status_code == status.HTTP_200_OK

        _login(api_client, store_keeper_user)
        assert api_client.post(f"/api/stock_request/{req_id}/mark_as_issued/").status_code == status.HTTP_200_OK

        issued_qty = AvailableChemical.objects.get(chemical_name=CHEMICAL_NAME).quantity

        resp = api_client.delete(f"/api/stock_request/{req_id}/")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "already been issued" in resp.data.get("detail", "")

        obj = StockRequest.objects.get(id=req_id)
        assert obj.status == "issued"
        assert AvailableChemical.objects.get(chemical_name=CHEMICAL_NAME).quantity == issued_qty

    def test_reported_cannot_be_deleted(self, api_client, staff_user, hod_user, store_keeper_user):
        _setup_inventory()
        _login(api_client, staff_user)
        req_id = _create(api_client).data["id"]

        _login(api_client, hod_user)
        assert api_client.post(f"/api/stock_request/{req_id}/accept/").status_code == status.HTTP_200_OK

        _login(api_client, store_keeper_user)
        assert api_client.post(f"/api/stock_request/{req_id}/mark_as_issued/").status_code == status.HTTP_200_OK

        _login(api_client, staff_user)
        item_id = StockRequest.objects.get(id=req_id).chemical_items.first().id
        resp = api_client.post(
            f"/api/stock_request/{req_id}/report_usage/",
            {"items": [{"id": item_id, "actual_used_quantity": "80.00"}]},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK

        reported_qty = AvailableChemical.objects.get(chemical_name=CHEMICAL_NAME).quantity

        _login(api_client, store_keeper_user)
        resp = api_client.delete(f"/api/stock_request/{req_id}/")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "already been issued" in resp.data.get("detail", "")

        obj = StockRequest.objects.get(id=req_id)
        assert obj.status == "reported"
        assert AvailableChemical.objects.get(chemical_name=CHEMICAL_NAME).quantity == reported_qty

    def test_staff_delete_own_request_is_soft(self, api_client, staff_user):
        _setup_inventory()
        _login(api_client, staff_user)
        req_id = _create(api_client).data["id"]

        resp = api_client.delete(f"/api/stock_request/{req_id}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT

        obj = StockRequest.objects.get(id=req_id)
        assert obj.status == "cancelled"
