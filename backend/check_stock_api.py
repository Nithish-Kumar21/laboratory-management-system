
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

def test_stock_register_api():
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
                
                print("\nFetching stock register...")
                stock_url = f"{BASE_URL}/stock_register/"
                headers = {'Authorization': f'Bearer {access_token}'}
                
                req_stock = urllib.request.Request(stock_url, headers=headers)
                try:
                    with urllib.request.urlopen(req_stock) as stock_response:
                        print(f"Status Code: {stock_response.status}")
                        stock_data = json.loads(stock_response.read().decode('utf-8'))
                        print("Data fetched successfully!")
                        print(json.dumps(stock_data, indent=2))
                except urllib.error.HTTPError as e:
                     print(f"Error fetching data: {e.code} {e.reason}")
                     print(e.read().decode('utf-8'))
            else:
                print(f"Login failed: {response.status}")
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    test_stock_register_api()
