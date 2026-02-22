from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from inventory.models import AvailableChemical, AvailableApparatus
from stock_register.models import StockRegister
from damaged_entry.models import DamagedEntry

User = get_user_model()

class RBACVerificationTest(APITestCase):
    def setUp(self):
        # Create users for each role
        self.admin = User.objects.create_user(
            employee_id='admin_test',
            email='admin@test.com',
            password='password123',
            role='admin',
            full_name='Admin User'
        )
        self.hod = User.objects.create_user(
            employee_id='hod_test',
            email='hod@test.com',
            password='password123',
            role='hod',
            full_name='HOD User'
        )
        self.store_keeper = User.objects.create_user(
            employee_id='sk_test',
            email='sk@test.com',
            password='password123',
            role='store_keeper',
            full_name='Store Keeper User'
        )
        self.staff = User.objects.create_user(
            employee_id='staff_test',
            email='staff@test.com',
            password='password123',
            role='staff',
            full_name='Staff User'
        )

    def get_tokens(self, username):
        response = self.client.post('/api/users/login/', {
            'username': username,
            'password': 'password123'
        })
        return response.data['access']

    def test_inventory_access(self):
        """
        inventory module: hod, store keeper, staff: view only
        """
        endpoints = ['/api/available_chemicals/', '/api/available_apparatus/']
        roles = ['hod_test', 'sk_test', 'staff_test', 'admin_test']
        
        for username in roles:
            token = self.get_tokens(username)
            self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
            
            for url in endpoints:
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_200_OK, f"Role {username} should have GET access to {url}")
                
                # Should NOT have POST access
                response = self.client.post(url, {})
                self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED])

    def test_stock_register_access(self):
        """
        stock register module:
        hod: view only
        store keeper: add new stocks (and view)
        staff: no access, no view
        """
        url = '/api/stock_register/'
        
        # Staff: No access
        token = self.get_tokens('staff_test')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # HOD: View only
        token = self.get_tokens('hod_test')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Store Keeper: Full Add/View
        token = self.get_tokens('sk_test')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Note: Empty POST might return 400 Bad Request but NOT 403 Forbidden
        response = self.client.post(url, {})
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_damaged_entry_access(self):
        """
        damaged entry module:
        hod: view only
        store keeper: add record (and view)
        staff: no access, no view
        """
        url = '/api/damaged_entry/'
        
        # Staff: No access
        token = self.get_tokens('staff_test')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # HOD: View only
        token = self.get_tokens('hod_test')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Store Keeper: Full Add/View
        token = self.get_tokens('sk_test')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self.client.post(url, {})
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)
