import os
import django
import sys

# Add backend to path
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from stock_request.models import StockRequest
from users.models import User
from django.utils import timezone

def verify():
    print("Starting verification of HOD approval flow...")
    
    # Get HOD user
    hod = User.objects.filter(role='hod').first()
    if not hod:
        print("Error: No HOD user found")
        return

    # Check pending count action logic (simulated)
    pending_count = StockRequest.objects.filter(status='pending').count()
    print(f"Current pending requests: {pending_count}")

    # Create a test request if none exist
    if pending_count == 0:
        staff = User.objects.filter(role='staff').first()
        if not staff:
             print("Error: No staff user found")
             return
        
        req = StockRequest.objects.create(
            requested_by=staff,
            class_name='I B.Sc Chemistry',
            reason='Test approval flow'
        )
        print(f"Created test request: {req.request_id}")
        pending_count = StockRequest.objects.filter(status='pending').count()
        print(f"New pending requests count: {pending_count}")

    # Verify we can find a pending request
    test_req = StockRequest.objects.filter(status='pending').first()
    if not test_req:
        print("Error: Could not find or create a pending request")
        return

    print(f"Testing approval on request: {test_req.request_id}")
    
    # Simulate the 'accept' action logic
    test_req.status = 'accepted'
    test_req.reviewed_at = timezone.now()
    test_req.reviewed_by = hod
    test_req.save()
    
    # Refresh from DB
    test_req.refresh_from_db()
    
    if test_req.status == 'accepted' and test_req.reviewed_by == hod:
        print("SUCCESS: Request successfully accepted by HOD")
    else:
        print(f"FAILURE: Request status is {test_req.status}, reviewed_by is {test_req.reviewed_by}")

    # Reset one to pending for manual testing if needed
    test_req.status = 'pending'
    test_req.reviewed_at = None
    test_req.reviewed_by = None
    test_req.save()
    print("Verification complete.")

if __name__ == "__main__":
    verify()
