from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import StockRegister, ChemicalItem, ApparatusItem
from .serializers import (
    StockRegisterListSerializer, 
    StockRegisterDetailSerializer,
    StockRegisterCreateSerializer
)
from django.db import transaction
from backend.permissions import StockRegisterPermission
from inventory.models import AvailableChemical, AvailableApparatus



class StockRegisterViewSet(viewsets.ModelViewSet):
    """
    API endpoint for stock register entries.
    List view: Shows invoice number, date, and supplier name.
    Detail view: Includes all chemical and apparatus items with make.
    Create: Accepts nested chemical and apparatus items with make and supplier_name.
    List supports ?ordering=invoice_number|-invoice_number|date|-date for sorting.
    """
    queryset = StockRegister.objects.all()
    permission_classes = [StockRegisterPermission]
    ordering_fields = ['invoice_number', 'date']

    def get_queryset(self):
        qs = super().get_queryset()
        ordering = self.request.query_params.get('ordering')
        if ordering in ('invoice_number', '-invoice_number', 'date', '-date'):
            return qs.order_by(ordering)
        return qs.order_by('-date')

    def get_serializer_class(self):
        if self.action == 'create':
            return StockRegisterCreateSerializer
        elif self.action == 'retrieve':
            return StockRegisterDetailSerializer
        return StockRegisterListSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=['get'])
    def chemical_names(self, request):
        """Get list of unique chemical names and available quantity for autocomplete"""
        data = AvailableChemical.objects.values('chemical_name', 'available_quantity_ml').order_by('chemical_name')
        # Map to consistent keys
        result = [{'name': item['chemical_name'], 'available_quantity': float(item['available_quantity_ml'])} for item in data]
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def apparatus_names(self, request):
        """Get list of unique apparatus names and available quantity for autocomplete"""
        data = AvailableApparatus.objects.values('apparatus_name', 'available_quantity_pieces').order_by('apparatus_name')
        result = [{'name': item['apparatus_name'], 'available_quantity': item['available_quantity_pieces']} for item in data]
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def supplier_names(self, request):
        """Get list of unique supplier names for autocomplete (NEW)"""
        names = StockRegister.objects.exclude(
            supplier_name__isnull=True
        ).exclude(
            supplier_name=''
        ).values_list('supplier_name', flat=True).distinct().order_by('supplier_name')
        return Response(list(names))
    
    @action(detail=False, methods=['get'])
    def chemical_makes(self, request):
        """Get list of unique chemical makes for autocomplete (NEW)"""
        makes = ChemicalItem.objects.exclude(
            make__isnull=True
        ).exclude(
            make=''
        ).values_list('make', flat=True).distinct().order_by('make')
        return Response(list(makes))
    
    @action(detail=False, methods=['get'])
    def apparatus_makes(self, request):
        """Get list of unique apparatus makes for autocomplete (NEW)"""
        makes = ApparatusItem.objects.exclude(
            make__isnull=True
        ).exclude(
            make=''
        ).values_list('make', flat=True).distinct().order_by('make')
        return Response(list(makes))
    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # 1. Deduct chemicals from inventory
        for chem in instance.chemical_items.all():
            try:
                available = AvailableChemical.objects.get(chemical_name=chem.chemical_name)
                available.available_quantity_ml -= chem.quantity_ml
                available.save()
            except AvailableChemical.DoesNotExist:
                pass
                
        # 2. Deduct apparatus from inventory
        for app in instance.apparatus_items.all():
            try:
                available = AvailableApparatus.objects.get(apparatus_name=app.apparatus_name)
                available.available_quantity_pieces -= app.quantity_pieces
                available.save()
            except AvailableApparatus.DoesNotExist:
                pass
                
        # 3. Delete related items manually since it's DO_NOTHING and managed=False
        # Note: We must delete items manually because of the database constraints/settings
        ChemicalItem.objects.filter(stock_register=instance).delete()
        ApparatusItem.objects.filter(stock_register=instance).delete()
        
        # 4. Delete the register entry
        return super().destroy(request, *args, **kwargs)
