from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import StockRequest
from .serializers import (
    StockRequestCreateSerializer,
    StockRequestListSerializer,
    StockRequestDetailSerializer,
)
from .permissions import StockRequestPermission


class StockRequestViewSet(viewsets.ModelViewSet):
    queryset = StockRequest.objects.all()
    permission_classes = [StockRequestPermission]

    def get_serializer_class(self):
        if self.action == 'create':
            return StockRequestCreateSerializer
        elif self.action in ['retrieve', 'accept', 'reject']:
            return StockRequestDetailSerializer
        return StockRequestListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == 'staff':
            return qs.filter(requested_by=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        if request.user.role != 'hod':
            return Response(
                {'error': 'Only HOD can accept requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        obj = self.get_object()
        if obj.status != 'pending':
            return Response(
                {'error': f'Request is already {obj.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj.status = 'accepted'
        obj.reviewed_at = timezone.now()
        obj.reviewed_by = request.user
        obj.save()
        return Response(StockRequestDetailSerializer(obj).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if request.user.role != 'hod':
            return Response(
                {'error': 'Only HOD can reject requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        obj = self.get_object()
        if obj.status != 'pending':
            return Response(
                {'error': f'Request is already {obj.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj.status = 'rejected'
        obj.reviewed_at = timezone.now()
        obj.reviewed_by = request.user
        obj.save()
        return Response(StockRequestDetailSerializer(obj).data)
