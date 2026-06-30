from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = AuditLog.objects.all()
        if user.role == 'hod':
            return qs
        if user.role == 'store_keeper':
            return qs.filter(
                action__in=[
                    'STOCK_ENTRY_ADDED', 'REQUEST_ISSUED', 'REQUEST_COMPLETED',
                ]
            )
        if user.role == 'staff':
            return qs.filter(
                action__in=[
                    'REQUEST_CREATED', 'REQUEST_SUBMITTED', 'REQUEST_CANCELLED',
                    'REQUEST_ACCEPTED', 'REQUEST_REJECTED', 'REQUEST_ISSUED',
                    'USAGE_REPORTED', 'REQUEST_COMPLETED',
                ],
                entity_id__in=[str(r.id) for r in user.stock_requests.all()],
            )
        return qs.none()
