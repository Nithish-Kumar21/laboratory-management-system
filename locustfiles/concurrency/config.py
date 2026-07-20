"""
Shared configuration for Locust concurrency tests.

Before running any Locust file, ensure:
  1. Django dev server is running:  cd backend && python manage.py runserver
  2. Test users and inventory are seeded:
     python backend/tests/load/test_race_conditions.py --setup-only --sk-password Test@Pass123!

Environment variables:
  LMS_BASE_URL  – Backend base URL (default: http://localhost:8000)
  LMS_SK_PW     – Store keeper password (default: Test@Pass123!)
"""
import os
import uuid
from locust import HttpUser, between, task, events

BASE_URL = os.getenv("LMS_BASE_URL", "http://localhost:8000")
SK_PASSWORD = os.getenv("LMS_SK_PW", "Test@Pass123!")
RUN_ID = uuid.uuid4().hex[:8]

# Pre-seeded user credentials (created by --setup-only)
STAFF_USERS = [
    {"employee_id": f"LSA_{RUN_ID}", "password": "Test@Pass123!"},
    {"employee_id": f"LSB_{RUN_ID}", "password": "Test@Pass123!"},
]
TEST_CHEMICAL = f"LocustTestChem_{RUN_ID}"
TEST_APPARATUS = f"LocustTestApp_{RUN_ID}"
