from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import StockRegister, ChemicalItem, ApparatusItem
from .serializers import (
    StockRegisterListSerializer, 
    StockRegisterDetailSerializer,
    StockRegisterCreateSerializer
)



class StockRegisterViewSet(viewsets.ModelViewSet):
    """
    API endpoint for stock register entries.
    List view: Shows invoice number, date, and supplier name.
    Detail view: Includes all chemical and apparatus items with make.
    Create: Accepts nested chemical and apparatus items with make and supplier_name.
    """
    queryset = StockRegister.objects.all().order_by('-date')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return StockRegisterCreateSerializer
        elif self.action == 'retrieve':
            return StockRegisterDetailSerializer
        return StockRegisterListSerializer
    
    @action(detail=False, methods=['get'])
    def chemical_names(self, request):
        """Get list of unique chemical names for autocomplete"""
        names = ChemicalItem.objects.values_list('chemical_name', flat=True).distinct().order_by('chemical_name')
        return Response(list(names))
    
    @action(detail=False, methods=['get'])
    def apparatus_names(self, request):
        """Get list of unique apparatus names for autocomplete"""
        names = ApparatusItem.objects.values_list('apparatus_name', flat=True).distinct().order_by('apparatus_name')
        return Response(list(names))
    
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
