import requests
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def get_token(username, password):
    url = f"{BASE_URL}/users/login/"
    payload = {"username": username, "password": password}
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        return response.json()["access"]
    else:
        print(f"Failed to login as {username}: {response.text}")
        return None

def test_rbac():
    test_users = [
        {"username": "test_hod", "password": "hod@123456", "role": "hod"},
        {"username": "test_store_keeper", "password": "storekeeper@123456", "role": "store_keeper"},
        {"username": "test_staff", "password": "staff@123456", "role": "staff"},
    ]

    modules = [
        {"name": "Inventory (Chemicals)", "url": "/available_chemicals/"},
        {"name": "Inventory (Apparatus)", "url": "/available_apparatus/"},
        {"name": "Stock Register", "url": "/stock_register/"},
        {"name": "Damaged Entry", "url": "/damaged_entry/"},
    ]

    results = []

    for user in test_users:
        token = get_token(user["username"], user["password"])
        if not token:
            continue
        
        headers = {"Authorization": f"Bearer {token}"}
        
        print(f"\n--- Testing User: {user['username']} (Role: {user['role']}) ---")
        
        for module in modules:
            url = f"{BASE_URL}{module['url']}"
            
            # Test GET (View)
            res_get = requests.get(url, headers=headers)
            status_get = res_get.status_code
            
            # Test POST (Add) - Sending minimal dummy data that should trigger 403 or 400 (not 404/500)
            res_post = requests.post(url, headers=headers, json={})
            status_post = res_post.status_code
            
            # Logic for verification:
            # - Staff: 403 for Stock/Damaged, 200 for Inventory
            # - HOD: 200 for all GET, 403 for all POST
            # - SK: 200 for all GET, 200/400 (not 403) for all POST
            
            is_valid = True
            
            if user["role"] == "staff":
                if module["name"].startswith("Inventory"):
                    if status_get != 200: is_valid = False
                else:
                    if status_get != 403: is_valid = False
            
            elif user["role"] == "hod":
                if status_get != 200: is_valid = False
                if status_post != 403: is_valid = False
                
            elif user["role"] == "store_keeper":
                if status_get != 200: is_valid = False
                if status_post == 403: is_valid = False # SK should have access to add
            
            result = {
                "user": user["username"],
                "role": user["role"],
                "module": module["name"],
                "get_status": status_get,
                "post_status": status_post,
                "passed": is_valid
            }
            results.append(result)
            
            marker = "✅" if is_valid else "❌"
            print(f"{marker} {module['name']}: GET={status_get}, POST={status_post}")

    print("\n\n--- Summary ---")
    all_passed = all(r["passed"] for r in results)
    if all_passed:
        print("ALL RBAC TESTS PASSED! 🚀")
    else:
        print("SOME TESTS FAILED! 🛑")

if __name__ == "__main__":
    test_rbac()
