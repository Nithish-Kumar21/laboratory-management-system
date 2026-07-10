import pytest
from rest_framework import status
from users.models import DegreeClass

pytestmark = pytest.mark.django_db


class TestClassesEndpoint:

    def test_staff_sees_only_own_degree(self, api_client, staff_user):
        DegreeClass.objects.create(degree='bsc', name='I B.Sc Chemistry', is_active=True)
        DegreeClass.objects.create(degree='bsc', name='II B.Sc Chemistry', is_active=True)
        DegreeClass.objects.create(degree='msc', name='I M.Sc Chemistry', is_active=True)
        DegreeClass.objects.create(degree='phd', name='PhD', is_active=True)

        staff_user.degree = 'bsc'
        staff_user.save()

        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(staff_user).access_token)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        resp = api_client.get('/api/classes/')
        assert resp.status_code == 200
        names = [c['name'] for c in resp.data['results']]
        assert 'I B.Sc Chemistry' in names
        assert 'II B.Sc Chemistry' in names
        assert 'I M.Sc Chemistry' not in names
        assert 'PhD' not in names

    def test_degree_query_param_ignored(self, api_client, staff_user):
        DegreeClass.objects.create(degree='bsc', name='I B.Sc Chemistry', is_active=True)
        DegreeClass.objects.create(degree='msc', name='I M.Sc Chemistry', is_active=True)

        staff_user.degree = 'bsc'
        staff_user.save()

        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(staff_user).access_token)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        resp = api_client.get('/api/classes/?degree=msc')
        assert resp.status_code == 200
        names = [c['name'] for c in resp.data['results']]
        assert 'I B.Sc Chemistry' in names
        assert 'I M.Sc Chemistry' not in names

    def test_hod_sees_all_classes(self, api_client, hod_user):
        DegreeClass.objects.create(degree='bsc', name='I B.Sc Chemistry', is_active=True)
        DegreeClass.objects.create(degree='msc', name='I M.Sc Chemistry', is_active=True)

        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(hod_user).access_token)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        resp = api_client.get('/api/classes/all/')
        assert resp.status_code == 200
        names = [c['name'] for c in resp.data['results']]
        assert 'I B.Sc Chemistry' in names
        assert 'I M.Sc Chemistry' in names

    def test_staff_no_degree_returns_empty(self, api_client, staff_user):
        staff_user.degree = None
        staff_user.save()

        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(staff_user).access_token)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        resp = api_client.get('/api/classes/')
        assert resp.status_code == 200
        assert resp.data['results'] == []
