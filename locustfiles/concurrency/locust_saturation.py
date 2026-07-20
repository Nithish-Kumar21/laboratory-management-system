"""
Locust load test for Scenario 6 – DB connection saturation.

Ramps up to 50 concurrent users hitting a mix of read/write endpoints
for sustained load.

Run:
  cd backend && python manage.py runserver

Seed test data first (see conftest.py in locustfiles/concurrency/).

Run:
  locust -f locustfiles/concurrency/locust_saturation.py \
    --host http://localhost:8000 \
    --users 50 --spawn-rate 5
"""
import uuid
import random
from locust import HttpUser, task, between

BASE_URL = "http://localhost:8000"
RUN_ID = uuid.uuid4().hex[:8]
CHEM_NAME = f"LocustTestChem_{RUN_ID}"
STAFF_EIDS = [f"LSA_{RUN_ID}", f"LSB_{RUN_ID}"]
STAFF_PW = "Test@Pass123!"


class SaturationUser(HttpUser):
    """Mix of read and write operations to saturate DB connections."""
    wait_time = between(0.05, 0.2)

    def on_start(self):
        idx = random.randint(0, len(STAFF_EIDS) - 1)
        resp = self.client.post("/api/users/login/", json={
            "username": STAFF_EIDS[idx], "password": STAFF_PW,
        })
        if resp.status_code == 200:
            self.token = resp.json()["access"]
        else:
            self.token = None
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        } if self.token else {}

    @task(3)
    def list_stock_requests(self):
        self.client.get("/api/stock_request/?status=all", headers=self.headers)

    @task(2)
    def list_chemicals(self):
        self.client.get("/api/stock_register/chemical_names/", headers=self.headers)

    @task(2)
    def list_available_chemicals(self):
        self.client.get("/api/available_chemicals/", headers=self.headers)

    @task(1)
    def create_draft(self):
        self.client.post("/api/stock_request/", json={
            "class_name": "I B.Sc Chemistry",
            "day_order": "I",
            "hour": [1],
            "purpose_type": "practical_lab",
            "experiment_name": f"Sat_{uuid.uuid4().hex[:4]}",
            "chemical_items": [
                {"chemical_name": CHEM_NAME, "quantity": "1.00"},
            ],
        }, headers=self.headers)

    @task(1)
    def pending_count(self):
        self.client.get("/api/stock_request/pending_count/", headers=self.headers)
