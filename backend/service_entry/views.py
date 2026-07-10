from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import ServiceEntry, ServiceEntryItem, ServiceEntryItemLog
from .serializers import (
    ServiceEntryListSerializer,
    ServiceEntryDetailSerializer,
    ServiceEntryCreateSerializer,
    ServiceActionSerializer,
)
from backend.permissions import ServiceEntryPermission


class ServiceEntryViewSet(viewsets.ModelViewSet):
    queryset = ServiceEntry.objects.all().order_by('-date')
    permission_classes = [ServiceEntryPermission]
    ordering_fields = ['date']

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter in ('in_service', 'completed'):
            qs = qs.filter(status=status_filter)
        ordering = self.request.query_params.get('ordering')
        if ordering in ('date', '-date'):
            return qs.order_by(ordering)
        return qs.order_by('-date')

    def get_serializer_class(self):
        if self.action == 'create':
            return ServiceEntryCreateSerializer
        elif self.action == 'retrieve':
            return ServiceEntryDetailSerializer
        return ServiceEntryListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @transaction.atomic
    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def action_item(self, request, pk=None):
        if request.user.role not in ['store_keeper', 'admin']:
            return Response(
                {'error': 'Only store keeper can log actions'},
                status=status.HTTP_403_FORBIDDEN
            )

        entry = self.get_object()
        if entry.status == 'completed':
            return Response(
                {'error': 'This service entry is already completed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        item_id = request.query_params.get('item_id')
        if not item_id:
            return Response(
                {'error': 'item_id query parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            item = ServiceEntryItem.objects.select_for_update().get(
                id=item_id,
                service_entry=entry
            )
        except ServiceEntryItem.DoesNotExist:
            return Response(
                {'error': 'Item not found in this service entry'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ServiceActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action_type = serializer.validated_data['action_type']
        quantity = serializer.validated_data['quantity']

        if quantity > item.quantity_remaining:
            return Response(
                {'error': f'Only {item.quantity_remaining} remaining in service'},
                status=status.HTTP_400_BAD_REQUEST
            )

        username = request.user.full_name if hasattr(request.user, 'full_name') else str(request.user)

        try:
            ServiceEntryItemLog.objects.create(
                service_entry_item=item,
                action_type=action_type,
                quantity=quantity,
                actioned_by=username,
            )
        except Exception:
            return Response(
                {'error': 'An unexpected database error occurred while recording the action. Please try again.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        item.refresh_from_db()
        entry.refresh_from_db()

        return Response(ServiceEntryDetailSerializer(entry).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def complete(self, request, pk=None):
        if request.user.role not in ['store_keeper', 'admin']:
            return Response(
                {'error': 'Only store keeper can complete service entries'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            entry = ServiceEntry.objects.select_for_update().get(pk=pk)
        except ServiceEntry.DoesNotExist:
            return Response(
                {'error': 'Service entry not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if entry.status == 'completed':
            return Response(
                {'error': 'This service entry is already completed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        incomplete_items = ServiceEntryItem.objects.filter(
            service_entry=entry, quantity_remaining__gt=0
        )
        if incomplete_items.exists():
            names = list(incomplete_items.values_list('apparatus_name', flat=True))
            return Response(
                {'error': f'Cannot complete — items still in service: {", ".join(names)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.utils import timezone
        entry.status = 'completed'
        entry.completed_at = timezone.now()
        entry.save()

        return Response(ServiceEntryDetailSerializer(entry).data)
