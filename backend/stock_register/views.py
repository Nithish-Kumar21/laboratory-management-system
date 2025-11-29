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
    List view: Shows invoice number and date only.
    Detail view: Includes all chemical and apparatus items.
    Create: Accepts nested chemical and apparatus items.
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
