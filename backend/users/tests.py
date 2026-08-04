from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase
from rest_framework import status
from rest_framework.settings import api_settings
from rest_framework.test import APITestCase

from .models import PasswordResetToken
from .serializers import (
    ChangePasswordSerializer,
    FirstLoginChangePasswordSerializer,
    UserCreateSerializer,
)

User = get_user_model()


class PasswordComplexityValidatorTests(SimpleTestCase):
    def _errors(self, password, user=None):
        try:
            validate_password(password, user=user)
        except ValidationError as e:
            return e.messages
        return []

    def test_rejects_missing_uppercase(self):
        errors = self._errors('lowercase1@')
        self.assertTrue(any('uppercase' in m for m in errors), errors)

    def test_rejects_missing_lowercase(self):
        errors = self._errors('UPPERCASE1@')
        self.assertTrue(any('lowercase' in m for m in errors), errors)

    def test_rejects_missing_digit(self):
        errors = self._errors('Password@abc')
        self.assertTrue(any('digit' in m for m in errors), errors)

    def test_rejects_missing_special_character(self):
        errors = self._errors('Password123')
        self.assertTrue(any('special character' in m for m in errors), errors)

    def test_rejects_password_equal_to_employee_id_case_insensitive(self):
        errors = self._errors('CHEMLAB123', user=SimpleNamespace(employee_id='chemlab123'))
        self.assertTrue(any('Employee ID' in m for m in errors), errors)

    def test_accepts_fully_valid_complex_password(self):
        self.assertEqual(
            self._errors('Strong@Pass9', user=SimpleNamespace(employee_id='chemlab123')),
            [],
        )

    def test_accepts_star_as_special_character_per_spec(self):
        self.assertEqual(
            self._errors('Strong*Pass9', user=SimpleNamespace(employee_id='chemlab123')),
            [],
        )


class UserCreateSerializerPasswordTests(TestCase):
    def _serializer(self, password):
        return UserCreateSerializer(data={
            'employee_id': 'EMP001',
            'full_name': 'Test Staff',
            'email': 'emp001@test.com',
            'phone': '+919876543210',
            'role': 'staff',
            'designation': 'Lab Assistant',
            'department': 'B.Sc Chemistry',
            'password': password,
        })

    def test_rejects_weak_password_on_user_creation(self):
        serializer = self._serializer('password123')
        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)
        messages = [str(m) for m in serializer.errors['password']]
        self.assertTrue(any('uppercase' in m for m in messages), messages)

    def test_rejects_password_equal_to_employee_id_on_user_creation(self):
        serializer = self._serializer('emp001')
        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)
        messages = [str(m) for m in serializer.errors['password']]
        self.assertTrue(any('Employee ID' in m for m in messages), messages)

    def test_accepts_valid_complex_password_on_user_creation(self):
        serializer = self._serializer('Strong@Pass9')
        self.assertTrue(serializer.is_valid(), serializer.errors)


class ChangePasswordSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            employee_id='CHEMLAB123',
            email='chem@test.com',
            full_name='Chem Staff',
            password='PreSet@Pass1',
            role='staff',
            phone='+911234567890',
            designation='Staff',
            department='B.Sc Chemistry',
        )

    def _serializer(self, new_password):
        return ChangePasswordSerializer(
            data={
                'old_password': 'PreSet@Pass1',
                'new_password': new_password,
                'confirm_password': new_password,
            },
            context={'request': SimpleNamespace(user=self.user)},
        )

    def test_rejects_new_password_equal_to_employee_id(self):
        serializer = self._serializer('chemlab123')
        self.assertFalse(serializer.is_valid())
        self.assertIn('new_password', serializer.errors)
        messages = [str(m) for m in serializer.errors['new_password']]
        self.assertTrue(any('Employee ID' in m for m in messages), messages)

    def test_rejects_new_password_same_as_current(self):
        serializer = self._serializer('PreSet@Pass1')
        self.assertFalse(serializer.is_valid())
        self.assertIn('new_password', serializer.errors)
        messages = [str(m) for m in serializer.errors['new_password']]
        self.assertTrue(any('same as the current password' in m for m in messages), messages)

    def test_accepts_valid_new_password(self):
        serializer = self._serializer('NewPass@123')
        self.assertTrue(serializer.is_valid(), serializer.errors)


class FirstLoginChangePasswordSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            employee_id='CHEMLAB123',
            email='chem@test.com',
            full_name='Chem Staff',
            password='PreSet@Pass1',
            role='staff',
            phone='+911234567890',
            designation='Staff',
            department='B.Sc Chemistry',
        )

    def _serializer(self, new_password):
        return FirstLoginChangePasswordSerializer(
            data={
                'new_password': new_password,
                'confirm_password': new_password,
            },
            context={'user': self.user},
        )

    def test_rejects_same_as_pre_set_password(self):
        serializer = self._serializer('PreSet@Pass1')
        self.assertFalse(serializer.is_valid())
        messages = [str(m) for m in serializer.errors.get('new_password', [])]
        self.assertTrue(any('same as the current password' in m for m in messages), messages)

    def test_rejects_weak_first_login_password(self):
        serializer = self._serializer('Password123')
        self.assertFalse(serializer.is_valid())
        messages = [str(m) for m in serializer.errors.get('new_password', [])]
        self.assertTrue(any('special character' in m for m in messages), messages)

    def test_accepts_valid_first_login_password(self):
        serializer = self._serializer('NewPass@123')
        self.assertTrue(serializer.is_valid(), serializer.errors)


class ResetPasswordViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            employee_id='CHEMLAB123',
            email='chem@test.com',
            full_name='Chem Staff',
            password='PreSet@Pass1',
            role='staff',
            phone='+911234567890',
            designation='Staff',
            department='B.Sc Chemistry',
        )

    def test_rejects_password_equal_to_employee_id(self):
        token = PasswordResetToken.create_for_user(self.user)
        resp = self.client.post('/api/users/reset-password/', {
            'token': token.token,
            'new_password': 'chemlab123',
            'confirm_password': 'chemlab123',
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn('new_password', resp.data)
        self.assertTrue(any('Employee ID' in str(m) for m in resp.data['new_password']))

    def test_rejects_new_password_same_as_old(self):
        token = PasswordResetToken.create_for_user(self.user)
        resp = self.client.post('/api/users/reset-password/', {
            'token': token.token,
            'new_password': 'PreSet@Pass1',
            'confirm_password': 'PreSet@Pass1',
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['error'], 'New password cannot be the same as the old password.')

    def test_accepts_valid_reset_password(self):
        token = PasswordResetToken.create_for_user(self.user)
        resp = self.client.post('/api/users/reset-password/', {
            'token': token.token,
            'new_password': 'NewPass@123',
            'confirm_password': 'NewPass@123',
        })
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass@123'))


class LoginThrottleTest(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            employee_id='THR001', email='thr@test.com',
            password='Throttle@Pass1', role='staff',
            full_name='Throttle Test', phone='+919876543210',
            designation='Staff', department='B.Sc Chemistry',
        )
        self._orig_rates = api_settings.DEFAULT_THROTTLE_RATES.copy()
        api_settings.DEFAULT_THROTTLE_RATES['login'] = '10/min'
        api_settings._cached_attrs.discard('DEFAULT_THROTTLE_RATES')

    def tearDown(self):
        api_settings.DEFAULT_THROTTLE_RATES.clear()
        api_settings.DEFAULT_THROTTLE_RATES.update(self._orig_rates)
        api_settings._cached_attrs.discard('DEFAULT_THROTTLE_RATES')
        cache.clear()

    def test_throttle_rejects_after_limit(self):
        for _ in range(10):
            resp = self.client.post('/api/users/login/', {
                'username': 'THR001', 'password': 'wrong',
            })
            self.assertNotEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        resp = self.client.post('/api/users/login/', {
            'username': 'THR001', 'password': 'wrong',
        })
        self.assertEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(resp.data['success'])
        self.assertIn('error', resp.data)

    def test_throttle_independent_of_account_lockout(self):
        for _ in range(10):
            self.client.post('/api/users/login/', {
                'username': 'THR001', 'password': 'wrong',
            })

        resp = self.client.post('/api/users/login/', {
            'username': 'THR001', 'password': 'wrong',
        })
        self.assertEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        self.user.refresh_from_db()
        self.assertLessEqual(self.user.failed_login_attempts, 5)
