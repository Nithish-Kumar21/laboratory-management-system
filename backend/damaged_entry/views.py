from rest_framework import viewsets, status
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import DamagedEntry, DamagedItem
from .serializers import (
    DamagedEntryListSerializer, 
    DamagedEntryDetailSerializer,
    DamagedEntryCreateSerializer
)
from inventory.models import AvailableApparatus  # ✅ Add this import
from backend.permissions import DamagedEntryPermission


class DamagedEntryViewSet(viewsets.ModelViewSet):
    """
    API endpoint for damaged entry records.
    Supports: GET (list), GET (detail), POST (create)
    List supports ?ordering=date|-date|staff|-staff|class_name|-class_name for sorting.
    """
    queryset = DamagedEntry.objects.all().order_by('-date')
    permission_classes = [DamagedEntryPermission]
    ordering_fields = ['date', 'staff', 'class_name']
    
    def get_queryset(self):
        qs = super().get_queryset()
        ordering = self.request.query_params.get('ordering')
        if ordering in ('date', '-date', 'staff', '-staff', 'class_name', '-class_name'):
            return qs.order_by(ordering)
        return qs.order_by('-date')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return DamagedEntryCreateSerializer
        elif self.action == 'retrieve':
            return DamagedEntryDetailSerializer
        return DamagedEntryListSerializer
    
    def create(self, request, *args, **kwargs):
        """Override create to add custom error handling"""
        serializer = self.get_serializer(data=request.data)
        
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
    
    @action(detail=False, methods=['get'])
    def apparatus_names(self, request):
        """Get list of apparatus names and available quantities for autocomplete"""
        apparatus = AvailableApparatus.objects.all().order_by('apparatus_name')
        data = [
            {'name': a.apparatus_name, 'available_quantity': a.available_quantity_pieces}
            for a in apparatus
        ]
        return Response(data)
    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # 1. Lock and increment apparatus in inventory
        for item in instance.damaged_items.all():
            try:
                available = AvailableApparatus.objects.select_for_update().get(apparatus_name=item.apparatus_name)
                available.available_quantity_pieces += item.quantity
                available.save()
            except AvailableApparatus.DoesNotExist:
                pass
                
        # 2. Delete related items manually since it's DO_NOTHING and managed=False
        DamagedItem.objects.filter(damaged_entry=instance).delete()
        
        # 3. Delete entry
        return super().destroy(request, *args, **kwargs)
