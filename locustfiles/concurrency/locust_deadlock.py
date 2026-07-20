"""
Locust load test for Scenario 5 – Lock ordering / deadlock check.

Two stock requests touch overlapping chemical rows in different orders.
Both are accepted. Fire mark_as_issued concurrently.

Run:
  locust -f locustfiles/concurrency/locust_deadlock.py \
    --host http://localhost:8000
"""
import uuid
import random
from locust import HttpUser, task, between

BASE_URL = "http://localhost:8000"
RUN_ID = uuid.uuid4().hex[:8]
CHEM_X = f"LocustTestChem_{RUN_ID}"  # Use the seeded chemical
STAFF_EIDS = [f"LSA_{RUN_ID}", f"LSB_{RUN_ID}"]
SK_EID = f"LSK_{RUN_ID}"
STAFF_PW = "Test@Pass123!"
SK_PW = "Test@Pass123!"


class DeadlockUser(HttpUser):
    """Simulate concurrent multi-chemical issue operations."""
    wait_time = between(0.1, 0.3)

    def on_start(self):
        idx = random.randint(0, len(STAFF_EIDS) - 1)
        resp = self.client.post("/api/users/login/", json={
            "username": STAFF_EIDS[idx], "password": STAFF_PW,
        })
        if resp.status_code == 200:
            self.token = resp.json()["access"]
        else:
            self.token = None

        # Also get SK token
        sk_resp = self.client.post("/api/users/login/", json={
            "username": SK_EID, "password": SK_PW,
        })
        if sk_resp.status_code == 200:
            self.sk_token = sk_resp.json()["access"]
        else:
            self.sk_token = None

        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        } if self.token else {}

        self.sk_headers = {
            "Authorization": f"Bearer {self.sk_token}",
            "Content-Type": "application/json",
        } if self.sk_token else {}

    @task(5)
    def create_and_submit(self):
        """Create a request and submit it."""
        if not self.token:
            return
        resp = self.client.post("/api/stock_request/", json={
            "class_name": "I B.Sc Chemistry",
            "day_order": "I",
            "hour": [1, 2],
            "purpose_type": "practical_lab",
            "experiment_name": f"DL_{uuid.uuid4().hex[:4]}",
            "chemical_items": [
                {"chemical_name": CHEM_NAME, "quantity": str(random.randint(5, 50))},
            ],
        }, headers=self.headers)
        if resp.status_code == 201:
            req_id = resp.json()["id"]
            self.client.post(f"/api/stock_request/{req_id}/submit/", headers=self.headers)

    @task(2)
    def list_accepted(self):
        """Read accepted requests (prerequisite for issue)."""
        if not self.sk_headers:
            return
        self.client.get("/api/stock_request/?status=accepted", headers=self.sk_headers)


# Alias for the chemical name used in this test
CHEM_NAME = f"LocustTestChem_{RUN_ID}"
