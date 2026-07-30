from .base import *

DEBUG = True

# Relax throttle for E2E testing
REST_FRAMEWORK = {**REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES': {'login': '1000/min'}}

ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

FRONTEND_URL = "http://localhost:3000"

# Log SQL queries in dev
LOGGING['loggers']['django.db.backends'] = {
    'handlers': ['console'],
    'level': 'DEBUG',
    'propagate': False,
}
