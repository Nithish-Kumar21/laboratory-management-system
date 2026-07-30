from .base import *
import os

DEBUG = False

ALLOWED_HOSTS = os.environ['ALLOWED_HOSTS'].split(',')

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ['CORS_ALLOWED_ORIGINS'].split(',')
]

LOGGING['loggers'].pop('django.db.backends', None)

# SECURE_SSL_REDIRECT = True  # Uncomment when SSL is configured
# SESSION_COOKIE_SECURE = True
# CSRF_COOKIE_SECURE = True
