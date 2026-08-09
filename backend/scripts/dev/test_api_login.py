"""Dev utility: quick smoke test of API login endpoint."""
import requests
r = requests.post('http://localhost:8000/api/users/login/', json={'username': 'test_hod', 'password': 'test123'}, headers={'Content-Type': 'application/json'})
print(f'Status: {r.status_code}')
print(f'Body: {r.text[:500]}')
