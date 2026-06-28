import os,django; os.environ['DJANGO_SETTINGS_MODULE']='backend.settings'; django.setup()
from django.db import connection
c = connection.cursor()
c.execute('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name')
for t in c.fetchall():
    print(t[0])
