
import os
import django
import sys
import json
import urllib.request
import urllib.parse
import urllib.error

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Use local test server URL
BASE_URL = 'http://127.0.0.1:8000/api'

def test_create_stock_entry():
    print("Logging in as admin...")
    login_url = f"{BASE_URL}/users/login/"
    login_data = {'username': 'admin', 'password': 'admin123'}
    
    try:
        data = json.dumps(login_data).encode('utf-8')
        req = urllib.request.Request(login_url, data=data, headers={'Content-Type': 'application/json'})
        
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print("Login successful!")
                response_body = response.read().decode('utf-8')
                tokens = json.loads(response_body)
                access_token = tokens['access']
                
                print("\nCreating new stock entry...")
                create_url = f"{BASE_URL}/stock_register/"
                headers = {
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json'
                }
                
                # Payload matching what frontend likely sends
                new_entry = {
                    "invoice_number": "INV-TEST-001",
                    "date": "2026-02-12",
                    "supplier_name": "Test Supplier",
                    "chemical_items": [
                        {
                            "chemical_name": "Test Chemical",
                            "quantity_ml": 500,
                            "rate": 100.50,
                            "make": "Test Make"
                        }
                    ],
                    "apparatus_items": [
                         {
                            "apparatus_name": "Test Beaker",
                            "quantity_pieces": 10,
                            "rate": 50.00,
                            "make": "Test Glassware"
                        }
                    ]
                }
                
                req_create = urllib.request.Request(create_url, data=json.dumps(new_entry).encode('utf-8'), headers=headers, method='POST')
                
                try:
                    with urllib.request.urlopen(req_create) as create_response:
                        print(f"Status Code: {create_response.status}")
                        print("Entry created successfully!")
                        print(create_response.read().decode('utf-8'))
                except urllib.error.HTTPError as e:
                     print(f"Error creating entry: {e.code} {e.reason}")
                     print(e.read().decode('utf-8'))

            else:
                print(f"Login failed: {response.status}")
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    test_create_stock_entry()
