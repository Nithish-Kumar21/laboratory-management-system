import requests
import json

BASE_URL = 'http://127.0.0.1:8000/api'

def test_stock_request_flow():
    print("--- Testing Stock Request Flow ---")
    
    # 1. Login as Staff
    print("\n1. Logging in as Staff...")
    login_url = f"{BASE_URL}/users/login/"
    login_data = {'username': 'test_staff', 'password': 'staff@123456'}
    
    try:
        response = requests.post(login_url, json=login_data)
        if response.status_code != 200:
            print(f"Login failed: {response.text}")
            return
            
        token = response.json()['access']
        print("Login successful.")
        
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        # 2. Create a Stock Request
        print("\n2. Creating a new Stock Request...")
        create_url = f"{BASE_URL}/stock_request/"
        request_data = {
            'reason': 'Urgent requirement for practicals',
            'chemical_items': [
                {'chemical_name': 'Hydrochloric Acid', 'quantity': 500}
            ],
            'apparatus_items': [
                {'apparatus_name': 'Test Tubes', 'quantity_pieces': 50}
            ]
        }
        
        response = requests.post(create_url, json=request_data, headers=headers)
        if response.status_code == 201:
            print("Stock Request created successfully.")
            request_id = response.json()['id']
            print(f"Request ID: {request_id}")
        else:
            print(f"Failed to create request: {response.text}")
            return

        # 3. List Stock Requests
        print("\n3. Listing Stock Requests...")
        list_url = f"{BASE_URL}/stock_request/"
        response = requests.get(list_url, headers=headers)
        
        if response.status_code == 200:
            requests_list = response.json()
            # Handle pagination if strictly configured, but usually list returns array or results
            if isinstance(requests_list, dict) and 'results' in requests_list:
                requests_list = requests_list['results']
                
            found = False
            for req in requests_list:
                if req['id'] == request_id:
                    print(f"Found our request in the list!")
                    print(f"ID: {req['id']}")
                    print(f"Reason: {req['reason']}")
                    print(f"Status: {req['status']}")
                    print(f"Chemicals: {req['chemical_items']}")
                    print(f"Apparatus: {req['apparatus_items']}")
                    found = True
                    break
            
            if not found:
                print("Error: Created request not found in list.")
        else:
            print(f"Failed to list requests: {response.text}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    test_stock_request_flow()
