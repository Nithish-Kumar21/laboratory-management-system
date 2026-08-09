"""Dev utility: trigger API rate limiting by sending multiple wrong password attempts."""
import requests
for i in range(6):
    r = requests.post('http://localhost:8000/api/users/login/', json={'username': 'test_hod', 'password': 'wrong'}, headers={'Content-Type': 'application/json'})
    print(f"Attempt {i+1}: {r.status_code} {r.text[:100]}")
