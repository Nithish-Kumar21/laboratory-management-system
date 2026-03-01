import urllib.request
import json

url = 'http://127.0.0.1:8000/api/users/login/'
data = {'username': 'admin', 'password': 'admin@123456'}
headers = {'Content-Type': 'application/json'}

try:
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
    with urllib.request.urlopen(req) as response:
        print(f"Status Code: {response.status}")
        print(f"Response: {response.read().decode('utf-8')}")
except Exception as e:
    print(f"Error contacting server: {e}")
