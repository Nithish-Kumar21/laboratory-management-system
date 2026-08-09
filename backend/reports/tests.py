from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class ReportYearValidationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            employee_id='HODREP1', email='hodrep@test.com',
            password='Hod@Rep1', role='hod',
            full_name='HOD Report', phone='+919876543213',
            designation='HOD', department='B.Sc Chemistry',
        )
        self.client.force_authenticate(self.user)

    def test_invalid_year_returns_400(self):
        resp = self.client.get('/api/reports/year-end/?year=abc')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid year', resp.data['error'])
