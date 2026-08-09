from .base import *
import os

DEBUG = False

ALLOWED_HOSTS = os.environ['ALLOWED_HOSTS'].split(',')

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ['CORS_ALLOWED_ORIGINS'].split(',')
]

LOGGING['loggers'].pop('django.db.backends', None)

# Force HTTPS for all requests
SECURE_SSL_REDIRECT = True
# Mark session cookies Secure (only sent over HTTPS)
SESSION_COOKIE_SECURE = True
# Mark CSRF cookies Secure (only sent over HTTPS)
CSRF_COOKIE_SECURE = True
# HSTS: enforce HTTPS for one year
SECURE_HSTS_SECONDS = 31536000  # 1 year
# Prevent MIME-type sniffing
SECURE_CONTENT_TYPE_NOSNIFF = True
# Enable browser XSS filter
SECURE_BROWSER_XSS_FILTER = True
# Deny framing of the site
X_FRAME_OPTIONS = 'DENY'
