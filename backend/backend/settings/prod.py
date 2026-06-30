from .base import *
import os

DEBUG = False

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')
if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['']:
    ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost', cast=lambda v: [h.strip() for h in v.split(',')])

CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
if not CORS_ALLOWED_ORIGINS or CORS_ALLOWED_ORIGINS == ['']:
    CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='http://localhost:3000', cast=lambda v: [h.strip() for h in v.split(',')])

# Remove SQL debug logging in prod
LOGGING['loggers'].pop('django.db.backends', None)

# SECURE_SSL_REDIRECT = True  # Uncomment when SSL is configured
# SESSION_COOKIE_SECURE = True
# CSRF_COOKIE_SECURE = True
