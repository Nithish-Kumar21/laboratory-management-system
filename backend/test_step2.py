import requests, json

BASE = 'http://127.0.0.1:8080/api'

def login_as(username, password):
    r = requests.post(BASE + '/users/login/', json={'username': username, 'password': password})
    if r.status_code != 200:
        print('Login failed for', username, r.text[:200])
        return None
    return r.json()['access']

hod_token = login_as('test_hod', 'hod@123456')
staff_token = login_as('test_staff', 'staff@123456')

if not hod_token:
    exit()

hod_headers = {'Authorization': 'Bearer ' + hod_token}
staff_headers = {'Authorization': 'Bearer ' + staff_token}

print('=== 1. Preview (no filter) ===')
r = requests.get(BASE + '/issue_register/report/', headers=hod_headers)
print('Status:', r.status_code)
if r.status_code == 200:
    d = r.json()
    print('  count=' + str(d['count']) + ' page=' + str(d['page']))
    if d['results']:
        row = d['results'][0]
        print('  first:', json.dumps(row, indent=2, default=str))
    else:
        print('  (no results)')
else:
    print('  Error:', r.text[:500])

print('\n=== 2. CSV Export ===')
r = requests.get(BASE + '/issue_register/report/?export=csv', headers=hod_headers)
print('Status:', r.status_code)
if r.status_code == 200:
    print('  Content-Type:', r.headers.get('Content-Type'))
    print('  Content-Disposition:', r.headers.get('Content-Disposition'))
    lines = r.text.split('\n')
    print('  Header:', lines[0])
    print('  Row 1:', lines[1] if len(lines) > 1 else '')
else:
    print('  Error:', r.text[:300])

print('\n=== 3. Staff 403 ===')
r = requests.get(BASE + '/issue_register/report/', headers=staff_headers)
print('Status:', r.status_code)

print('\n=== 4. Invalid day_order (0) ===')
r = requests.get(BASE + '/issue_register/report/?day_order=0', headers=hod_headers)
print('Status:', r.status_code, '|', r.text[:200])

print('\n=== 5. Invalid hour (6) ===')
r = requests.get(BASE + '/issue_register/report/?hour=6', headers=hod_headers)
print('Status:', r.status_code, '|', r.text[:200])

print('\n=== 6. Invalid week ===')
r = requests.get(BASE + '/issue_register/report/?week=bad', headers=hod_headers)
print('Status:', r.status_code, '|', r.text[:200])

print('\n=== 7. Filter by month ===')
r = requests.get(BASE + '/issue_register/report/?month=2026-07', headers=hod_headers)
print('Status:', r.status_code, 'count=' + str(r.json().get('count')))

print('\n=== 8. Filter by day_order=1 and hour=1 ===')
r = requests.get(BASE + '/issue_register/report/?day_order=1&hour=1', headers=hod_headers)
print('Status:', r.status_code, 'count=' + str(r.json().get('count')))
if r.status_code == 200 and r.json()['results']:
    print('  first:', json.dumps(r.json()['results'][0], indent=2, default=str))
