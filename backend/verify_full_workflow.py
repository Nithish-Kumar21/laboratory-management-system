import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.test import Client
from stock_request.models import StockRequest, StockRequestChemicalItem, IssueRegister, IssueChemicals
from inventory.models import AvailableChemical

User = get_user_model()

def get_or_create_user(employee_id, email, password, role, full_name, designation, phone):
    try:
        user = User.objects.get(employee_id=employee_id)
        print(f"    Found user by ID: {employee_id}")
    except User.DoesNotExist:
        try:
            user = User.objects.get(email=email)
            print(f"    Found user by email: {email}")
        except User.DoesNotExist:
            print(f"    Creating user: {employee_id}")
            user = User.objects.create_user(
                employee_id=employee_id,
                email=email,
                full_name=full_name,
                password=password,
                role=role,
                department='B.Sc Chemistry',
                designation=designation,
                phone=phone
            )
            return user

    # Update fields to ensure they match test requirements
    user.employee_id = employee_id
    user.email = email
    user.role = role
    
    # Only set password if it's a new password or we want to reset it.
    # user.set_password(password) # Avoid resetting if we want to keep existing
    user.save()
    return user

def run_verification():
    print("--- Starting Full Workflow Verification ---")

    # 1. Setup Test Data
    print("\n[1] Setting up test data...")
    
    staff = get_or_create_user(
        'STAFF001', 'staff@test.com', 'password123', 'staff', 
        'Test Staff', 'Lab Assistant', '+919999999001'
    )
    
    hod = get_or_create_user(
        'HOD001', 'hod@test.com', 'password123', 'hod',
        'Test HOD', 'HOD', '+919999999002'
    )
    
    store_keeper = get_or_create_user(
        'STORE001', 'store@test.com', 'password123', 'store_keeper',
        'Test Store Keeper', 'Store Keeper', '+919999999003'
    )

    # Create Inventory Item
    chem_name = 'Test Chemical HCL'
    chem, created = AvailableChemical.objects.get_or_create(
        chemical_name=chem_name,
        defaults={'quantity': 1000.00, 'unit': 'ml'}
    )
    # Reset quantity for consistent test
    chem.quantity = 1000.00
    chem.unit = 'ml'
    chem.save()
    print(f"    Inventory: {chem.chemical_name} = {chem.quantity} {chem.unit}")

    # Clients
    client_staff = Client()
    client_staff.force_login(staff)
    
    client_hod = Client()
    client_hod.force_login(hod)

    client_store = Client()
    client_store.force_login(store_keeper)

    # Clean up any existing requests for test users to start fresh
    StockRequest.objects.filter(requested_by=staff).delete()
    print("    Cleaned up old requests.")

    # 2. Create Request (Staff)
    print("\n[2] Staff creating request...")
    payload = {
        'class_name': 'I B.Sc Chemistry',
        'reason': 'Lab Session 1',
        'chemical_items': [
            {'chemical_name': chem_name, 'quantity': 100.00}
        ],
        'status': 'pending'  # Submit directly
    }
    response = client_staff.post('/api/stock_request/', payload, content_type='application/json')
    if response.status_code != 201:
        print(f"FAILED: Create request failed {response.status_code} {response.data}")
        return
    
    req_id = response.data['id']
    print(f"    Request Created: ID={req_id}, Status={response.data['status']}")
    
    # 3. Approve Request (HOD)
    print("\n[3] HOD approving request...")
    response = client_hod.post(f'/api/stock_request/{req_id}/accept/')
    if response.status_code != 200:
        print(f"FAILED: Approval failed {response.status_code} {response.data}")
        return
    
    req = StockRequest.objects.get(id=req_id)
    print(f"    Request Status: {req.status}")
    if req.status != 'accepted':
        print("FAILED: Status should be 'accepted'")
        return

    # 4. Issue Request (Store Keeper)
    print("\n[4] Store Keeper issuing request...")
    response = client_store.post(f'/api/stock_request/{req_id}/mark_as_issued/')
    if response.status_code != 200:
        print(f"FAILED: Issue failed {response.status_code} {response.data}")
        return
    
    req.refresh_from_db()
    chem.refresh_from_db()
    print(f"    Request Status: {req.status}")
    print(f"    Issued At: {req.issued_at}")
    print(f"    Inventory after issue: {chem.quantity} {chem.unit}")
    
    if req.status != 'issued':
         print("FAILED: Status should be 'issued'")
         return
    if chem.quantity != 900.00:
         print(f"FAILED: Inventory should be 900.00, got {chem.quantity}")
         return

    # 5. Report Usage (Staff)
    print("\n[5] Staff reporting usage...")
    # Report using only 80ml (so 20ml returned)
    report_payload = {
        'items': [
            {'id': req.chemical_items.first().id, 'actual_used_quantity': 80.00}
        ]
    }
    response = client_staff.post(f'/api/stock_request/{req_id}/report_usage/', report_payload, content_type='application/json')
    if response.status_code != 200:
        print(f"FAILED: Report usage failed {response.status_code} {response.data}")
        return

    req.refresh_from_db()
    item = req.chemical_items.first()
    print(f"    Request Status: {req.status}")
    print(f"    Reported At: {req.reported_at}")
    print(f"    Item Actual Usage: {item.actual_used_quantity}")

    if req.status != 'reported':
         print("FAILED: Status should be 'reported'")
         return
    if item.actual_used_quantity != 80.00:
         print("FAILED: Actual usage not saved correctly")
         return

    # 6. Complete Request (Store Keeper)
    print("\n[6] Store Keeper completing request...")
    response = client_store.post(f'/api/stock_request/{req_id}/mark_as_completed/')
    if response.status_code != 200:
        print(f"FAILED: Completion failed {response.status_code} {response.data}")
        return

    req.refresh_from_db()
    chem.refresh_from_db()
    print(f"    Request Status: {req.status}")
    print(f"    Completed At: {req.completed_at}")
    print(f"    Inventory after completion: {chem.quantity} {chem.unit}")
    
    # Logic: Issued 100 (Inv=900). Reported 80 used. Returned 20.
    # Inventory should increase by 20 -> 920.
    if req.status != 'completed':
         print("FAILED: Status should be 'completed'")
         return
    if chem.quantity != 920.00:
         print(f"FAILED: Inventory should be 920.00 (900 + 20 returned), got {chem.quantity}")
         return

    # 7. Check Issue Register
    print("\n[7] Checking Issue Register...")
    # Find the latest entry for this staff and date
    ir = IssueRegister.objects.filter(staff_name=staff.full_name, date=req.date).order_by('-ir_id').first()
    if not ir:
        print("FAILED: Issue Register entry not created")
        return
    
    print(f"    Issue Register Entry: {ir}")
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT chemical_name, issued_quantity, actual_usage, returned FROM issue_chemicals WHERE ir_id = %s", [ir.ir_id])
        row = cursor.fetchone()
        name, issued, actual, returned = row
        print(f"    Item: {name}, Req: {issued}, Act: {actual}, Ret: {returned}")
    
    if returned != 20.00:
        print(f"FAILED: Returned quantity should be 20.00, got {returned}")
        return

    # 8. Check Active Request Lock
    print("\n[8] Checking Active Request Lock...")
    # Staff already has a completed request, so they SHOULD be able to create a new one.
    response = client_staff.post('/api/stock_request/', payload, content_type='application/json')
    if response.status_code != 201:
        print(f"FAILED: Should be allowed to create new request after completion. Got {response.status_code}")
    else:
        print("    Success: Created new request after completion.")
        # Setup cleanup again
        new_req_id = response.data['id']
        
        # Now try to create ANOTHER one while this one is pending
        print("    Attempting to create concurrent request (should fail)...")
        response_fail = client_staff.post('/api/stock_request/', payload, content_type='application/json')
        if response_fail.status_code == 400 and 'active request' in str(response_fail.data):
             # Note: exact error message might vary, checking keyword
            print("    Success: Blocked concurrent request.")
        else:
            print(f"FAILED: Should have blocked concurrent request. Got {response_fail.status_code} {response_fail.data}")

    print("\n--- Verification Completed Successfully ---")

if __name__ == '__main__':
      run_verification()
