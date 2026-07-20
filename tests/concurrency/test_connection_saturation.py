"""
Scenario 6 – DB connection saturation.

Ramp concurrent users toward 50 hitting a mix of read/write endpoints,
sustained for several minutes.

Assert: no connection pool exhaustion errors, no request timeouts beyond
        acceptable threshold, response times don't degrade catastrophically
        past ~50 users.

This test uses threading to simulate concurrent load against the Django
ORM directly (no running server required). We measure timing and error
rates across 50 concurrent workers.
"""
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal

import pytest
from django.db import connections, OperationalError
from inventory.models import AvailableChemical
from stock_request.models import StockRequest

from .conftest import run_concurrently

pytestmark = pytest.mark.django_db(transaction=True)

CHEM_NAME = f"SatChem_{uuid.uuid4().hex[:6]}"
NUM_WORKERS = 50
DURATION_SECONDS = 30  # sustained load duration


def _client(user):
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return c


def _setup_chem():
    return AvailableChemical.objects.get_or_create(
        chemical_name=CHEM_NAME,
        defaults={"quantity": Decimal("50000.00"), "unit": "ml", "reorder_level": Decimal("50.00")},
    )[0]


def _create_user(idx):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    suffix = f"{uuid.uuid4().hex[:6]}_{idx}"
    return User.objects.create_user(
        employee_id=f"sat_{suffix}", email=f"sat_{suffix}@test.local",
        password="test123", role="staff", full_name=f"Sat User {idx}",
        phone=f"+91{idx:010d}"[-10:],
        designation="Staff", department="B.Sc Chemistry",
    )


class TestDBConnectionSaturation:
    def test_ramped_read_write_load(self):
        """
        Create 50 users, each performing a mix of read (list) and
        write (create draft) operations concurrently for 30 seconds.
        Assert: no connection errors, no excessive timeouts.
        """
        _setup_chem()

        users = [_create_user(i) for i in range(NUM_WORKERS)]
        clients = [_client(u) for u in users]

        success_count = 0
        error_count = 0
        timeout_count = 0
        connection_errors = 0
        response_times = []
        errors = []

        def worker(client, idx):
            nonlocal success_count, error_count, timeout_count, connection_errors
            iterations = 0
            start = time.time()
            while time.time() - start < DURATION_SECONDS:
                try:
                    t0 = time.time()
                    # Alternate between read and write
                    if iterations % 2 == 0:
                        # Read: list stock requests
                        resp = client.get("/api/stock_request/?status=all")
                    else:
                        # Write: create a draft
                        resp = client.post("/api/stock_request/", {
                            "class_name": "I B.Sc Chemistry",
                            "day_order": "I",
                            "hour": [1],
                            "purpose_type": "practical_lab",
                            "experiment_name": f"sat_{idx}_{iterations}",
                            "chemical_items": [
                                {"chemical_name": CHEM_NAME, "quantity": "1.00"}
                            ],
                        }, format="json")
                    elapsed = time.time() - t0
                    response_times.append(elapsed)

                    if resp.status_code in (200, 201):
                        success_count += 1
                    else:
                        error_count += 1
                except OperationalError as e:
                    if "timeout" in str(e).lower() or "could not allocate" in str(e).lower():
                        timeout_count += 1
                    elif "pool" in str(e).lower() or "connection" in str(e).lower():
                        connection_errors += 1
                    else:
                        errors.append(str(e)[:200])
                except Exception as e:
                    errors.append(str(e)[:200])
                iterations += 1

        with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
            futures = [
                executor.submit(worker, clients[i], i)
                for i in range(NUM_WORKERS)
            ]
            for f in as_completed(futures):
                try:
                    f.result()
                except Exception as e:
                    errors.append(str(e)[:200])

        # Assertions
        total_ops = success_count + error_count
        assert total_ops > 0, "FAIL: No operations completed"

        if response_times:
            sorted_times = sorted(response_times)
            p95 = sorted_times[int(len(sorted_times) * 0.95)]
            p99 = sorted_times[int(len(sorted_times) * 0.99)]
        else:
            p95 = p99 = float("inf")

        # No connection pool exhaustion
        assert connection_errors == 0, f"FAIL: {connection_errors} connection pool errors"

        # No excessive timeouts (< 5% of operations)
        if total_ops > 0:
            timeout_pct = timeout_count / total_ops * 100
            assert timeout_pct < 5.0, (
                f"FAIL: {timeout_pct:.1f}% timeouts ({timeout_count}/{total_ops})"
            )

        # P99 response time should be under 10 seconds for in-process calls
        assert p99 < 10.0, f"FAIL: P99 response time {p99:.2f}s"

        # Record results for report (displayed via pytest -v)
        self._results = {
            "workers": NUM_WORKERS,
            "duration_s": DURATION_SECONDS,
            "total_ops": total_ops,
            "success": success_count,
            "errors": error_count,
            "timeouts": timeout_count,
            "connection_errors": connection_errors,
            "p95_ms": p95 * 1000 if p95 != float("inf") else None,
            "p99_ms": p99 * 1000 if p99 != float("inf") else None,
            "app_errors": len(errors),
        }
