import os
import subprocess
import pytest
from django.test import override_settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()

THROTTLE_ENABLED_RF = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
    'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
    'NON_FIELD_ERRORS_KEY': 'error',
    'DATETIME_FORMAT': '%Y-%m-%d %H:%M:%S',
    'DEFAULT_THROTTLE_CLASSES': ['users.throttles.LoginRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {'login': '5/min'},
}


@pytest.fixture(autouse=True)
def _clear_drf_api_cache():
    """Clear DRF's api_settings cache AND SimpleRateThrottle.THROTTLE_RATES
    so override_settings REST_FRAMEWORK takes effect.

    SimpleRateThrottle.THROTTLE_RATES is a class attribute frozen at import
    time to settings_test's empty dict. We must patch it directly.
    """
    from rest_framework import settings as drf_settings
    from rest_framework.throttling import SimpleRateThrottle
    api = drf_settings.api_settings
    # Save originals
    saved_class_rates = SimpleRateThrottle.THROTTLE_RATES
    # Patch class attribute to include login scope (matches base.py)
    SimpleRateThrottle.THROTTLE_RATES = {'login': '5/min'}
    # Clear api_settings cache so re-reads hit django.conf.settings
    if hasattr(api, '_user_settings'):
        del api._user_settings
    for attr in list(api._cached_attrs):
        try:
            delattr(api, attr)
        except AttributeError:
            pass
    api._cached_attrs.clear()
    yield
    # Restore originals
    SimpleRateThrottle.THROTTLE_RATES = saved_class_rates
    if hasattr(api, '_user_settings'):
        del api._user_settings
    for attr in list(api._cached_attrs):
        try:
            delattr(api, attr)
        except AttributeError:
            pass
    api._cached_attrs.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def throttle_user(db):
    user = User.objects.create_user(
        employee_id='throttle_user',
        email='throttle@test.com',
        password='Correct@123',
        role='staff',
        full_name='Throttle Test User',
        phone='+919999999910',
        designation='Staff',
        department='B.Sc Chemistry',
        is_first_login=False,
        password_must_change=False,
    )
    return user


@pytest.fixture
def lockout_user(db):
    user = User.objects.create_user(
        employee_id='lockout_user',
        email='lockout@test.com',
        password='Correct@456',
        role='staff',
        full_name='Lockout Test User',
        phone='+919999999911',
        designation='Staff',
        department='B.Sc Chemistry',
        is_first_login=False,
        password_must_change=False,
    )
    return user


@pytest.mark.django_db
class TestSecretKeyMissingCrashesApp:
    def test_secret_key_missing_crashes_app(self):
        backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
        dotenv_path = os.path.join(backend_dir, '.env')
        dotenv_backup = dotenv_path + '.bak'

        try:
            if os.path.exists(dotenv_path):
                os.rename(dotenv_path, dotenv_backup)

            env = os.environ.copy()
            env.pop('SECRET_KEY', None)
            env['DJANGO_SETTINGS_MODULE'] = 'backend.settings.dev'
            result = subprocess.run(
                ['python', 'manage.py', 'check'],
                env=env,
                capture_output=True,
                text=True,
                cwd=backend_dir,
            )
            assert result.returncode != 0, (
                "manage.py check should fail when SECRET_KEY is missing"
            )
            assert 'SECRET_KEY' in result.stderr or 'KeyError' in result.stderr, (
                f"Expected SECRET_KEY-related error in stderr, got:\n{result.stderr}"
            )
        finally:
            if os.path.exists(dotenv_backup):
                os.rename(dotenv_backup, dotenv_path)


@pytest.mark.django_db
class TestDebugFalseNoTracebackLeak:
    @override_settings(DEBUG=False)
    def test_500_response_hides_traceback(self, monkeypatch):
        from users import views as user_views

        def broken_authenticate(*args, **kwargs):
            raise RuntimeError("Intentional test error for DEBUG=False check")

        monkeypatch.setattr(user_views, 'authenticate', broken_authenticate)

        client = APIClient()
        client.raise_request_exception = False

        resp = client.post(
            '/api/users/login/',
            {'username': 'anyone', 'password': 'anything'},
            format='json',
        )

        assert resp.status_code == 500
        body = resp.content.decode()
        assert 'Traceback' not in body, "Traceback leaked in 500 response"
        assert 'File "' not in body, "File path leaked in 500 response"
        assert 'SELECT ' not in body, "SQL leaked in 500 response"
        assert 'backend/' not in body, "Python file path leaked in 500 response"


@pytest.mark.django_db
class TestLoginThrottle:
    @override_settings(REST_FRAMEWORK=THROTTLE_ENABLED_RF)
    def test_throttle_fires_at_6th_attempt(self, api_client, throttle_user):
        cache.clear()

        for i in range(5):
            resp = api_client.post(
                '/api/users/login/',
                {'username': 'throttle_user', 'password': 'wrong'},
                format='json',
            )
            assert resp.status_code == status.HTTP_401_UNAUTHORIZED, (
                f"Request {i+1} should return 401, got {resp.status_code}"
            )

        resp = api_client.post(
            '/api/users/login/',
            {'username': 'throttle_user', 'password': 'wrong'},
            format='json',
        )
        assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS, (
            f"Request 6 should return 429 (throttled), got {resp.status_code}"
        )

        cache.clear()

    @override_settings(REST_FRAMEWORK=THROTTLE_ENABLED_RF)
    def test_throttle_message_is_clear(self, api_client, throttle_user):
        cache.clear()

        for _ in range(5):
            api_client.post(
                '/api/users/login/',
                {'username': 'throttle_user', 'password': 'wrong'},
                format='json',
            )

        resp = api_client.post(
            '/api/users/login/',
            {'username': 'throttle_user', 'password': 'wrong'},
            format='json',
        )
        assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        body = resp.json()
        assert 'detail' in body or 'error' in body or 'Retry-After' in resp.headers

        cache.clear()


@pytest.mark.django_db
class TestAccountLockout:
    @override_settings(REST_FRAMEWORK=THROTTLE_ENABLED_RF)
    def test_lockout_fires_independently_of_throttle(self, api_client, lockout_user):
        cache.clear()

        for i in range(5):
            resp = api_client.post(
                '/api/users/login/',
                {'username': 'lockout_user', 'password': 'wrong'},
                format='json',
            )
            assert resp.status_code == status.HTTP_401_UNAUTHORIZED, (
                f"Request {i+1} should return 401, got {resp.status_code}"
            )

        lockout_user.refresh_from_db()
        assert lockout_user.failed_login_attempts >= 5, (
            f"Expected failed_login_attempts >= 5, got {lockout_user.failed_login_attempts}"
        )
        assert lockout_user.account_locked_until is not None, (
            "Expected account_locked_until to be set"
        )

        cache.clear()

        resp = api_client.post(
            '/api/users/login/',
            {'username': 'lockout_user', 'password': 'Correct@456'},
            format='json',
        )
        # Locked accounts return the same generic 401 as invalid credentials to
        # prevent user enumeration (session-hardening behavior).
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED, (
            f"Locked account should return 401, got {resp.status_code}"
        )
        body = resp.json()
        assert 'failed attempts' in body.get('error', '').lower(), (
            f"Expected lockout message in error, got: {body}"
        )
        assert resp.status_code != status.HTTP_429_TOO_MANY_REQUESTS, (
            "Response should be 401 (locked), not 429 (throttle)"
        )

        cache.clear()
