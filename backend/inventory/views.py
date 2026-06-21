from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from .models import (
    AvailableChemical, AvailableApparatus,
    LowStockChemical, LowStockApparatus,
    LabConfiguration
)
from .serializers import (
    AvailableChemicalSerializer, AvailableApparatusSerializer,
    LowStockChemicalSerializer, LowStockApparatusSerializer,
    LabConfigurationSerializer
)
from backend.permissions import InventoryPermission

class AvailableChemicalViewSet(viewsets.ModelViewSet):
    """
    API endpoint for viewing and updating available chemicals.
    """
    queryset = AvailableChemical.objects.filter(available_quantity_ml__gte=0)
    serializer_class = AvailableChemicalSerializer
    permission_classes = [InventoryPermission]
    http_method_names = ['get', 'patch', 'head', 'options']

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def names(self, request):
        """Get list of chemical names and available quantity"""
        data = AvailableChemical.objects.values('chemical_name', 'available_quantity_ml').order_by('chemical_name')
        result = [{'name': item['chemical_name'], 'available_quantity': float(item['available_quantity_ml']), 'unit': 'ml'} for item in data]
        return Response(result)

class AvailableApparatusViewSet(viewsets.ModelViewSet):
    """
    API endpoint for viewing and updating available apparatus.
    """
    queryset = AvailableApparatus.objects.filter(available_quantity_pieces__gte=0)
    serializer_class = AvailableApparatusSerializer
    permission_classes = [InventoryPermission]
    http_method_names = ['get', 'patch', 'head', 'options']

    @action(detail=False, methods=['get'])
    def names(self, request):
        """Get list of apparatus names and available quantity"""
        data = AvailableApparatus.objects.values('apparatus_name', 'available_quantity_pieces').order_by('apparatus_name')
        result = [{'name': item['apparatus_name'], 'available_quantity': item['available_quantity_pieces']} for item in data]
        return Response(result)

class LowStockChemicalViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing low stock chemicals.
    """
    queryset = LowStockChemical.objects.all()
    serializer_class = LowStockChemicalSerializer
    permission_classes = [InventoryPermission]


class LowStockApparatusViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing low stock apparatus.
    """
    queryset = LowStockApparatus.objects.all()
    serializer_class = LowStockApparatusSerializer
    permission_classes = [InventoryPermission]

class LabConfigurationViewSet(viewsets.ModelViewSet):
    """
    API endpoint for lab configuration (singleton).
    """
    queryset = LabConfiguration.objects.all()
    serializer_class = LabConfigurationSerializer
    permission_classes = [InventoryPermission] # Store keepers already have access via InventoryPermission logic? Actually I should check permissions.py

    def get_queryset(self):
        # Ensure we always deal with the first record (singleton-like)
        return LabConfiguration.objects.all()[:1]

    def list(self, request, *args, **kwargs):
        config, created = LabConfiguration.objects.get_or_create(id=1)
        serializer = self.get_serializer(config)
        return Response(serializer.data)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        config, created = LabConfiguration.objects.get_or_create(id=1)
        serializer = self.get_serializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # If common reorder level is enabled, update all existing items
        if config.use_common_reorder_level:
            AvailableChemical.objects.all().update(reorder_level=config.common_chemical_reorder_level)
            AvailableApparatus.objects.all().update(reorder_level=config.common_apparatus_reorder_level)

        return Response(serializer.data)
