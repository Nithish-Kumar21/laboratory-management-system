import requests
r = requests.post('http://127.0.0.1:8000/api/users/login/', json={'username': 'test_store_keeper', 'password': 'Test@1234'})
token = r.json()['access']
h = {'Authorization': f'Bearer {token}'}
r2 = requests.get('http://127.0.0.1:8000/api/stock_register/', headers=h)
data = r2.json()
results = data.get('results', [])
if results:
    sr_id = results[0]['id']
    r3 = requests.get(f'http://127.0.0.1:8000/api/stock_register/{sr_id}/', headers=h)
    detail = r3.json()
    for ci in detail.get('chemical_items', []):
        has_packs = 'no_of_packs' in ci
        cname = ci['chemical_name']
        print(f'Chemical: {cname}')
        print(f'  no_of_packs in response: {has_packs}')
        nop = ci.get('no_of_packs', 'MISSING')
        print(f'  no_of_packs value: {nop}')
        print(f'  All keys: {list(ci.keys())}')
else:
    print('No stock entries found')
