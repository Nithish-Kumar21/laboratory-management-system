from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True, default='')

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_name', 'action', 'entity_type',
            'entity_id', 'description', 'ip_address', 'timestamp',
        ]
        read_only_fields = fields
