import urllib.request, json, sys, time

BASE = 'http://127.0.0.1:8000/api/'

def test(endpoint):
    try:
        resp = urllib.request.urlopen(BASE + endpoint, timeout=10)
        data = json.loads(resp.read())
        items = data if isinstance(data, list) else data.get('results', [])
        print(f'{endpoint}: {len(items)} items')
        if items:
            print(f'  First item keys: {list(items[0].keys())}')
            print(f'  quantity type: {type(items[0].get("quantity")).__name__}')
            print(f'  quantity value: {items[0].get("quantity")}')
            print(f'  unit value: {items[0].get("unit")}')
    except Exception as e:
        print(f'{endpoint} ERROR: {e}')

print('Testing API endpoints...')
time.sleep(2)
test('available_chemicals/')
test('stock_request/')
