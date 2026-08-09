"""Dev utility: quick smoke test of API wrong-password handling."""
import requests
r = requests.post('http://localhost:8000/api/users/login/', json={'username': 'test_hod', 'password': 'wrongpassword'}, headers={'Content-Type': 'application/json'})
print(f'Status: {r.status_code}')
print(f'Headers: {dict(r.headers)}')
print(f'Body: {r.text[:500]}')
