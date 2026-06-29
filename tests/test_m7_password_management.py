import pytest
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def first_login_user(db):
    """User with is_first_login=True (simulates newly created user)."""
    user = User.objects.create_user(
        employee_id='newstaff', email='newstaff@test.com', password='Temp@1234',
        role='staff', full_name='New Staff', phone='+919999999901',
        designation='Staff', department='B.Sc Chemistry',
    )
    user.is_first_login = True
    user.password_must_change = True
    user.save()
    return user


@pytest.fixture
def normal_user(db):
    """User who has already completed first login."""
    user = User.objects.create_user(
        employee_id='normal1', email='normal1@test.com', password='Current@123',
        role='staff', full_name='Normal Staff', phone='+919999999902',
        designation='Staff', department='B.Sc Chemistry',
    )
    user.is_first_login = False
    user.password_must_change = False
    user.save()
    return user


@pytest.fixture
def normal_user_token(normal_user):
    refresh = RefreshToken.for_user(normal_user)
    return str(refresh.access_token)


@pytest.fixture
def password_reset_user(db):
    user = User.objects.create_user(
        employee_id='resetuser', email='reset@test.com', password='OldPass@123',
        role='staff', full_name='Reset User', phone='+919999999903',
        designation='Staff', department='B.Sc Chemistry',
    )
    user.is_first_login = False
    user.password_must_change = False
    return user


# ─── Test 1: Login with first_login user returns temp_token ────────────────

class TestFirstLoginFlow:
    def test_login_returns_temp_token_for_first_login_user(self, api_client, first_login_user):
        resp = api_client.post('/api/users/login/', {'username': 'newstaff', 'password': 'Temp@1234'}, format='json')
        assert resp.status_code == 200
        data = resp.json()
        assert data['first_login'] is True
        assert 'temp_token' in data
        assert data['user_id'] == first_login_user.id

    def test_temp_token_has_correct_purpose(self, api_client, first_login_user):
        resp = api_client.post('/api/users/login/', {'username': 'newstaff', 'password': 'Temp@1234'}, format='json')
        token = AccessToken(resp.json()['temp_token'])
        assert token['purpose'] == 'change_password'
        assert token['user_id'] == first_login_user.id

    def test_first_login_change_password_success(self, api_client, first_login_user):
        # Login to get temp_token
        login_resp = api_client.post('/api/users/login/', {'username': 'newstaff', 'password': 'Temp@1234'}, format='json')
        temp_token = login_resp.json()['temp_token']

        # Change password with temp_token
        resp = api_client.post(
            '/api/users/change-password/',
            {'new_password': 'NewSecure@456', 'confirm_password': 'NewSecure@456'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {temp_token}'
        )
        assert resp.status_code == 200
        data = resp.json()
        assert 'access' in data
        assert 'refresh' in data
        assert 'user' in data
        assert data['user']['is_first_login'] is False
        assert data['user']['password_must_change'] is False

        # Verify can login with new password
        login2 = api_client.post('/api/users/login/', {'username': 'newstaff', 'password': 'NewSecure@456'}, format='json')
        assert login2.status_code == 200
        assert 'access' in login2.json()

    def test_first_login_rejects_short_password(self, api_client, first_login_user):
        login_resp = api_client.post('/api/users/login/', {'username': 'newstaff', 'password': 'Temp@1234'}, format='json')
        temp_token = login_resp.json()['temp_token']

        resp = api_client.post(
            '/api/users/change-password/',
            {'new_password': 'Ab1$', 'confirm_password': 'Ab1$'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {temp_token}'
        )
        assert resp.status_code == 400
        assert 'new_password' in resp.json()

    def test_first_login_rejects_mismatch(self, api_client, first_login_user):
        login_resp = api_client.post('/api/users/login/', {'username': 'newstaff', 'password': 'Temp@1234'}, format='json')
        temp_token = login_resp.json()['temp_token']

        resp = api_client.post(
            '/api/users/change-password/',
            {'new_password': 'NewSecure@456', 'confirm_password': 'Different@789'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {temp_token}'
        )
        assert resp.status_code == 400

    def test_first_login_rejects_same_password(self, api_client, first_login_user):
        login_resp = api_client.post('/api/users/login/', {'username': 'newstaff', 'password': 'Temp@1234'}, format='json')
        temp_token = login_resp.json()['temp_token']

        resp = api_client.post(
            '/api/users/change-password/',
            {'new_password': 'Temp@1234', 'confirm_password': 'Temp@1234'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {temp_token}'
        )
        assert resp.status_code == 400

    def test_expired_temp_token_rejected(self, api_client, first_login_user):
        # Create an expired token manually
        expired = AccessToken()
        expired['user_id'] = first_login_user.id
        expired['purpose'] = 'change_password'
        expired.set_exp(lifetime=-timezone.timedelta(minutes=1))

        resp = api_client.post(
            '/api/users/change-password/',
            {'new_password': 'NewSecure@456', 'confirm_password': 'NewSecure@456'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {str(expired)}'
        )
        assert resp.status_code == 401

    def test_wrong_token_purpose_is_valid_auth_token(self, api_client, first_login_user):
        """A token with an unrecognized purpose is still a valid JWT — DRF auth uses it."""
        wrong = AccessToken()
        wrong['user_id'] = first_login_user.id
        wrong['purpose'] = 'refresh'

        # With old_password provided (lenient for is_first_login users), the normal flow works
        resp = api_client.post(
            '/api/users/change-password/',
            {'old_password': 'anything', 'new_password': 'NewSecure@456', 'confirm_password': 'NewSecure@456'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {str(wrong)}'
        )
        assert resp.status_code == 200
        assert resp.json()['message'] == 'Password changed successfully.'


# ─── Test 2: Authenticated change password ─────────────────────────────────

class TestAuthenticatedChangePassword:
    def test_change_password_success(self, api_client, normal_user, normal_user_token):
        resp = api_client.post(
            '/api/users/change-password/',
            {'old_password': 'Current@123', 'new_password': 'NewPass@789', 'confirm_password': 'NewPass@789'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {normal_user_token}'
        )
        assert resp.status_code == 200
        assert resp.json()['message'] == 'Password changed successfully.'

        # Verify new password works
        login_resp = api_client.post('/api/users/login/', {'username': 'normal1', 'password': 'NewPass@789'}, format='json')
        assert login_resp.status_code == 200

    def test_change_password_wrong_old(self, api_client, normal_user, normal_user_token):
        resp = api_client.post(
            '/api/users/change-password/',
            {'old_password': 'WrongOld@123', 'new_password': 'NewPass@789', 'confirm_password': 'NewPass@789'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {normal_user_token}'
        )
        assert resp.status_code == 400

    def test_change_password_mismatch(self, api_client, normal_user, normal_user_token):
        resp = api_client.post(
            '/api/users/change-password/',
            {'old_password': 'Current@123', 'new_password': 'NewPass@789', 'confirm_password': 'Diff@456'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {normal_user_token}'
        )
        assert resp.status_code == 400

    def test_change_password_same_as_old(self, api_client, normal_user, normal_user_token):
        resp = api_client.post(
            '/api/users/change-password/',
            {'old_password': 'Current@123', 'new_password': 'Current@123', 'confirm_password': 'Current@123'},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {normal_user_token}'
        )
        assert resp.status_code == 400

    def test_unauthenticated_change_password_rejected(self, api_client):
        resp = api_client.post(
            '/api/users/change-password/',
            {'old_password': 'x', 'new_password': 'New@1234', 'confirm_password': 'New@1234'},
            format='json',
        )
        assert resp.status_code == 401


# ─── Test 3: Forgot Password ──────────────────────────────────────────────

class TestForgotPassword:
    def test_forgot_password_valid_user(self, api_client, password_reset_user):
        resp = api_client.post(
            '/api/users/forgot-password/',
            {'employee_id': 'resetuser', 'email': 'reset@test.com'},
            format='json',
        )
        assert resp.status_code == 200
        assert 'message' in resp.json()

    def test_forgot_password_invalid_employee_id(self, api_client, db):
        resp = api_client.post(
            '/api/users/forgot-password/',
            {'employee_id': 'nonexistent', 'email': 'any@test.com'},
            format='json',
        )
        # Returns success regardless to prevent user enumeration
        assert resp.status_code == 200

    def test_forgot_password_wrong_email(self, api_client, password_reset_user):
        resp = api_client.post(
            '/api/users/forgot-password/',
            {'employee_id': 'resetuser', 'email': 'wrong@test.com'},
            format='json',
        )
        assert resp.status_code == 200

    def test_forgot_password_missing_fields(self, api_client):
        resp = api_client.post(
            '/api/users/forgot-password/',
            {'employee_id': 'x'},
            format='json',
        )
        assert resp.status_code == 400


# ─── Test 4: Reset Password ───────────────────────────────────────────────

class TestResetPassword:
    def test_verify_valid_token(self, api_client, password_reset_user):
        from users.models import PasswordResetToken
        token = PasswordResetToken.create_for_user(password_reset_user)

        resp = api_client.get(f'/api/users/reset-password/verify/?token={token.token}')
        assert resp.status_code == 200
        assert resp.json()['valid'] is True

    def test_verify_invalid_token(self, api_client, db):
        resp = api_client.get('/api/users/reset-password/verify/?token=bogus-token')
        assert resp.status_code == 400

    def test_verify_missing_token(self, api_client):
        resp = api_client.get('/api/users/reset-password/verify/')
        assert resp.status_code == 400

    def test_reset_password_success(self, api_client, password_reset_user):
        from users.models import PasswordResetToken
        token = PasswordResetToken.create_for_user(password_reset_user)

        resp = api_client.post(
            '/api/users/reset-password/',
            {'token': token.token, 'new_password': 'NewReset@789', 'confirm_password': 'NewReset@789'},
            format='json',
        )
        assert resp.status_code == 200
        assert 'Password reset successful' in resp.json()['message']

        # Verify token is marked as used
        token.refresh_from_db()
        assert token.used is True

        # Verify new password works
        login_resp = api_client.post('/api/users/login/', {'username': 'resetuser', 'password': 'NewReset@789'}, format='json')
        assert login_resp.status_code == 200

    def test_reset_password_mismatch(self, api_client, password_reset_user):
        from users.models import PasswordResetToken
        token = PasswordResetToken.create_for_user(password_reset_user)

        resp = api_client.post(
            '/api/users/reset-password/',
            {'token': token.token, 'new_password': 'New@1234', 'confirm_password': 'Diff@5678'},
            format='json',
        )
        assert resp.status_code == 400

    def test_reset_password_expired_token(self, api_client, password_reset_user):
        from users.models import PasswordResetToken
        from datetime import timedelta
        expired = PasswordResetToken.objects.create(
            user=password_reset_user,
            token='expired-test-token-12345',
            expires_at=timezone.now() - timedelta(minutes=1)
        )
        resp = api_client.post(
            '/api/users/reset-password/',
            {'token': expired.token, 'new_password': 'New@1234', 'confirm_password': 'New@1234'},
            format='json',
        )
        assert resp.status_code == 400

    def test_reset_password_used_token(self, api_client, password_reset_user):
        from users.models import PasswordResetToken
        token = PasswordResetToken.create_for_user(password_reset_user)
        token.used = True
        token.save()

        resp = api_client.post(
            '/api/users/reset-password/',
            {'token': token.token, 'new_password': 'New@1234', 'confirm_password': 'New@1234'},
            format='json',
        )
        assert resp.status_code == 400

    def test_reset_password_same_as_old(self, api_client, password_reset_user):
        from users.models import PasswordResetToken
        token = PasswordResetToken.create_for_user(password_reset_user)

        resp = api_client.post(
            '/api/users/reset-password/',
            {'token': token.token, 'new_password': 'OldPass@123', 'confirm_password': 'OldPass@123'},
            format='json',
        )
        assert resp.status_code == 400


# ─── Test 5: Login edge cases ─────────────────────────────────────────────

class TestLoginEdgeCases:
    def test_login_missing_credentials(self, api_client):
        resp = api_client.post('/api/users/login/', {}, format='json')
        assert resp.status_code == 400

    def test_login_invalid_credentials(self, api_client, first_login_user):
        resp = api_client.post('/api/users/login/', {'username': 'newstaff', 'password': 'wrong'}, format='json')
        assert resp.status_code == 401

    def test_normal_user_login_returns_tokens(self, api_client, normal_user):
        resp = api_client.post('/api/users/login/', {'username': 'normal1', 'password': 'Current@123'}, format='json')
        assert resp.status_code == 200
        data = resp.json()
        assert 'access' in data
        assert 'refresh' in data
        assert 'user' in data
        assert 'first_login' not in data or data['first_login'] is False
