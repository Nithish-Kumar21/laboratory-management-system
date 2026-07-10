import requests, json

BASE = 'http://127.0.0.1:8080/api'

# Login as HOD
r = requests.post(BASE + '/users/login/', json={'username': 'test_hod', 'password': 'hod@123456'})
token = r.json()['access']
headers = {'Authorization': 'Bearer ' + token}
print('=== Logged in as HOD ===')

# Preview
r1 = requests.get(BASE + '/stock_register/report/', headers=headers)
print('Preview:', r1.status_code)
if r1.status_code == 200:
    d = r1.json()
    print('  count=' + str(d['count']) + ' page=' + str(d['page']) + ' total_pages=' + str(d['total_pages']))
    if d['results']:
        print('  first result:', json.dumps(d['results'][0], indent=2, default=str))
else:
    print('  Error:', r1.text[:500])

# CSV export
r2 = requests.get(BASE + '/stock_register/report/?export=csv', headers=headers)
print('\nCSV export:', r2.status_code)
if r2.status_code == 200:
    print('  Content-Type:', r2.headers.get('Content-Type'))
    print('  Content-Disposition:', r2.headers.get('Content-Disposition'))
    lines = r2.text.split('\n')
    print('  Header:', lines[0] if lines else '')
    print('  Row 1:', lines[1] if len(lines) > 1 else '')
else:
    print('  Error:', r2.text[:300])

# Filter by month
r3 = requests.get(BASE + '/stock_register/report/?month=2026-07', headers=headers)
print('\nFilter month=2026-07:', r3.status_code, 'count=' + str(r3.json().get('count')))

# Staff 403
rs = requests.post(BASE + '/users/login/', json={'username': 'test_staff', 'password': 'staff@123456'})
staff_token = rs.json()['access']
r4 = requests.get(BASE + '/stock_register/report/', headers={'Authorization': 'Bearer ' + staff_token})
print('\nStaff access:', r4.status_code)

# Invalid week 400
r5 = requests.get(BASE + '/stock_register/report/?week=invalid', headers=headers)
print('\nInvalid week:', r5.status_code)
if r5.status_code != 200:
    print('  Response:', r5.text[:200])
