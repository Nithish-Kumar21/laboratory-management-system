from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    AUDIT_ACTION_CHOICES = [
        ('USER_CREATED', 'User Created'),
        ('USER_UPDATED', 'User Updated'),
        ('USER_DEACTIVATED', 'User Deactivated'),
        ('PASSWORD_CHANGED', 'Password Changed'),
        ('LOGIN_SUCCESS', 'Login Success'),
        ('LOGIN_FAILED', 'Login Failed'),
        ('ACCOUNT_LOCKED', 'Account Locked'),
        ('STOCK_ENTRY_ADDED', 'Stock Entry Added'),
        ('REQUEST_CREATED', 'Request Created'),
        ('REQUEST_SUBMITTED', 'Request Submitted'),
        ('REQUEST_CANCELLED', 'Request Cancelled'),
        ('REQUEST_ACCEPTED', 'Request Accepted'),
        ('REQUEST_REJECTED', 'Request Rejected'),
        ('REQUEST_ISSUED', 'Request Issued'),
        ('USAGE_REPORTED', 'Usage Reported'),
        ('REQUEST_COMPLETED', 'Request Completed'),
        ('DAMAGE_REPORTED', 'Damage Reported'),
        ('REPORT_GENERATED', 'Report Generated'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
    )
    action = models.CharField(max_length=60, choices=AUDIT_ACTION_CHOICES)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=50, null=True, blank=True)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_log'
        managed = True
        ordering = ['-timestamp']

    def save(self, *args, **kwargs):
        if self.pk:
            raise PermissionError('Audit logs are immutable and cannot be updated.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError('Audit logs are immutable and cannot be deleted.')

    def __str__(self):
        return f'{self.timestamp} | {self.action} | {self.entity_type}#{self.entity_id}'
