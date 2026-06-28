import pytest
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()
pytestmark = pytest.mark.django_db


class TestM6UserCreationWorkflow:

    NEW_EMP_ID = "new_staff_01"
    NEW_EMAIL = "newstaff@test.com"
    NEW_PASSWORD = "NewPass@123"

    def test_hod_creates_staff_user(self, api_client, hod_user, hod_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {hod_token}')
        resp = api_client.post('/api/users/', {
            'employee_id': self.NEW_EMP_ID,
            'full_name': 'New Staff User',
            'email': self.NEW_EMAIL,
            'phone': '+919999999995',
            'role': 'staff',
            'designation': 'Lab Assistant',
            'department': 'B.Sc Chemistry',
            'password': self.NEW_PASSWORD,
        }, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        assert User.objects.filter(employee_id=self.NEW_EMP_ID).exists()

    def test_new_user_login_forced_password_change(self, api_client):
        User.objects.create_user(
            employee_id=self.NEW_EMP_ID, email=self.NEW_EMAIL,
            password=self.NEW_PASSWORD, role='staff',
            full_name='New Staff User', phone='+919999999995',
            designation='Lab Assistant', department='B.Sc Chemistry',
            password_must_change=True
        )
        login_resp = api_client.post('/api/users/login/', {
            'username': self.NEW_EMP_ID, 'password': self.NEW_PASSWORD
        })
        assert login_resp.status_code == status.HTTP_200_OK
        assert login_resp.data.get('user', {}).get('password_must_change') is True

    def test_change_password_and_login(self, api_client):
        user = User.objects.create_user(
            employee_id=self.NEW_EMP_ID, email=self.NEW_EMAIL,
            password=self.NEW_PASSWORD, role='staff',
            full_name='New Staff User', phone='+919999999995',
            designation='Lab Assistant', department='B.Sc Chemistry',
            password_must_change=True
        )
        login_resp = api_client.post('/api/users/login/', {
            'username': self.NEW_EMP_ID, 'password': self.NEW_PASSWORD
        })
        token = login_resp.data['access']

        new_password = "ChangedPass@456"
        change_resp = api_client.post('/api/users/change-password/', {
            'old_password': self.NEW_PASSWORD,
            'new_password': new_password,
            'confirm_password': new_password,
        }, HTTP_AUTHORIZATION=f'Bearer {token}')
        assert change_resp.status_code == status.HTTP_200_OK

        user.refresh_from_db()
        assert user.password_must_change is False

        new_login = api_client.post('/api/users/login/', {
            'username': self.NEW_EMP_ID, 'password': new_password
        })
        assert new_login.status_code == status.HTTP_200_OK
        assert 'access' in new_login.data

    def test_new_user_can_access_requests(self, api_client):
        user = User.objects.create_user(
            employee_id=self.NEW_EMP_ID, email=self.NEW_EMAIL,
            password=self.NEW_PASSWORD, role='staff',
            full_name='New Staff User', phone='+919999999995',
            designation='Lab Assistant', department='B.Sc Chemistry',
            password_must_change=False
        )
        login_resp = api_client.post('/api/users/login/', {
            'username': self.NEW_EMP_ID, 'password': self.NEW_PASSWORD
        })
        token = login_resp.data['access']
        resp = api_client.get('/api/stock_request/', HTTP_AUTHORIZATION=f'Bearer {token}')
        assert resp.status_code == status.HTTP_200_OK

    def test_non_hod_cannot_create_user(self, api_client, staff_token):
        resp = api_client.post('/api/users/', {
            'employee_id': 'unauth_user',
            'full_name': 'Unauthorized',
            'email': 'unauth@test.com',
            'phone': '+919999999996',
            'role': 'staff',
            'designation': 'Staff',
            'department': 'B.Sc Chemistry',
            'password': 'Test@123',
        }, HTTP_AUTHORIZATION=f'Bearer {staff_token}', format='json')
        assert resp.status_code == status.HTTP_403_FORBIDDEN
