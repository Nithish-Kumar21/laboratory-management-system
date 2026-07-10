import pytest
from audit.models import AuditLog
from rest_framework import status


class TestAuditLogModel:
    def test_audit_log_created(self, db):
        log = AuditLog.objects.create(
            action='LOGIN_SUCCESS',
            entity_type='User',
            entity_id='1',
            description='User logged in',
        )
        assert log.pk is not None
        assert log.timestamp is not None

    def test_audit_log_immutable_update(self, db):
        log = AuditLog.objects.create(
            action='LOGIN_SUCCESS',
            entity_type='User',
            entity_id='1',
            description='User logged in',
        )
        with pytest.raises(PermissionError, match='Audit logs are immutable'):
            log.description = 'changed'
            log.save()

    def test_audit_log_immutable_delete(self, db):
        log = AuditLog.objects.create(
            action='LOGIN_SUCCESS',
            entity_type='User',
            entity_id='1',
            description='User logged in',
        )
        with pytest.raises(PermissionError, match='Audit logs are immutable'):
            log.delete()


class TestAuditLogEndpoint:
    def test_hod_can_view_audit_logs(self, auth_hod):
        AuditLog.objects.all().delete()
        log = AuditLog.objects.create(
            action='LOGIN_SUCCESS',
            entity_type='User',
            entity_id='1',
            description='Test log',
        )
        resp = auth_hod.get('/api/audit-logs/')
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        results = data if isinstance(data, list) else data.get('results', [])
        ids = [item['id'] for item in results]
        assert log.id in ids

    def test_staff_cannot_view_unrelated_logs(self, auth_staff):
        AuditLog.objects.all().delete()
        AuditLog.objects.create(
            action='LOGIN_SUCCESS',
            entity_type='User',
            entity_id='999',
            description='Unrelated log',
        )
        resp = auth_staff.get('/api/audit-logs/')
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        results = data if isinstance(data, list) else data.get('results', [])
        assert len(results) == 0

    def test_unauthenticated_cannot_view(self, api_client):
        resp = api_client.get('/api/audit-logs/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


class TestAuditLoggingOnActions:
    def test_login_creates_audit_log(self, staff_user, api_client):
        AuditLog.objects.all().delete()
        resp = api_client.post('/api/users/login/', {
            'username': 'staff_test', 'password': 'test123'
        }, format='json')
        assert resp.status_code == 200
        logs = AuditLog.objects.filter(action='LOGIN_SUCCESS')
        assert logs.count() == 1

    def test_stock_request_create_logs_audit(self, auth_staff, existing_chemical, today):
        AuditLog.objects.all().delete()
        resp = auth_staff.post('/api/stock_request/', {
            'chemical_items': [{'chemical_name': 'Hydrochloric Acid', 'quantity': 10, 'unit': 'ml'}],
            'class_name': 'I B.Sc Chemistry',
            'date': today.isoformat(),
        }, format='json')
        assert resp.status_code == 201, f'Expected 201, got {resp.status_code}: {resp.content[:500]}'
        logs = AuditLog.objects.filter(action='REQUEST_CREATED')
        assert logs.count() == 1

    def test_stock_request_submit_logs_audit(self, auth_staff, existing_chemical, today):
        AuditLog.objects.all().delete()
        create_resp = auth_staff.post('/api/stock_request/', {
            'chemical_items': [{'chemical_name': 'Hydrochloric Acid', 'quantity': 10, 'unit': 'ml'}],
            'class_name': 'I B.Sc Chemistry',
            'date': today.isoformat(),
            'status': 'draft',
        }, format='json')
        assert create_resp.status_code == 201
        req_id = create_resp.json()['id']
        resp = auth_staff.post(f'/api/stock_request/{req_id}/submit/')
        assert resp.status_code == 200, f'Expected 200, got {resp.status_code}: {resp.content[:500]}'
        logs = AuditLog.objects.filter(action='REQUEST_SUBMITTED')
        assert logs.count() == 1

    def test_password_change_logs_audit(self, staff_user, api_client):
        AuditLog.objects.all().delete()
        login_resp = api_client.post('/api/users/login/', {
            'username': 'staff_test', 'password': 'test123'
        }, format='json')
        token = login_resp.json()['access']
        resp = api_client.post('/api/users/change-password/', {
            'new_password': 'NewPass@789', 'confirm_password': 'NewPass@789',
            'old_password': 'test123',
        }, format='json', HTTP_AUTHORIZATION=f'Bearer {token}')
        assert resp.status_code == 200
        logs = AuditLog.objects.filter(action='PASSWORD_CHANGED')
        assert logs.count() == 1

    def test_stock_entry_creates_audit_log(self, auth_store_keeper):
        AuditLog.objects.all().delete()
        resp = auth_store_keeper.post('/api/stock_register/', {
            'invoice_number': 'INV-AUDIT-001',
            'supplier_name': 'Test Supplier Audit',
            'date': '2026-06-30',
            'chemical_items': [{'chemical_name': 'Ethanol', 'make': 'TestCorp', 'quantity': 100, 'unit': 'ml', 'rate': '500.00'}],
        }, format='json')
        assert resp.status_code == 201, f'Expected 201, got {resp.status_code}: {resp.content[:1000].decode()}'
        logs = AuditLog.objects.filter(action='STOCK_ENTRY_ADDED')
        assert logs.count() == 1
