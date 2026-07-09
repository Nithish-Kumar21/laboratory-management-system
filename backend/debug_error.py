import requests, re

BASE = 'http://127.0.0.1:8080/api'

r = requests.post(BASE + '/users/login/', json={'username': 'test_hod', 'password': 'hod@123456'})
token = r.json()['access']
headers = {'Authorization': 'Bearer ' + token}

r1 = requests.get(BASE + '/stock_register/report/', headers=headers)

# Extract exception
m = re.search(r'<pre class="exception_value">([^<]+)</pre>', r1.text)
if m:
    print('Exception:', m.group(1))

# Get last traceback lines
m2 = re.search(r'<pre class="traceback">(.*?)</pre>', r1.text, re.DOTALL)
if m2:
    tb = m2.group(1)
    lines = tb.strip().split('\n')
    for l in lines[-6:]:
        print(l.strip()[:200])
else:
    print('No traceback found, showing first 1000 chars:')
    print(r1.text[:1000])
