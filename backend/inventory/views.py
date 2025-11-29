from rest_framework import viewsets
from .models import (
    AvailableChemical, AvailableApparatus,
    LowStockChemical, LowStockApparatus
)
from .serializers import (
    AvailableChemicalSerializer, AvailableApparatusSerializer,
    LowStockChemicalSerializer, LowStockApparatusSerializer
)

class AvailableChemicalViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing available chemicals.
    """
    queryset = AvailableChemical.objects.all()
    serializer_class = AvailableChemicalSerializer

class AvailableApparatusViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing available apparatus.
    """
    queryset = AvailableApparatus.objects.all()
    serializer_class = AvailableApparatusSerializer

class LowStockChemicalViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing low stock chemicals.
    """
    queryset = LowStockChemical.objects.all()
    serializer_class = LowStockChemicalSerializer


class LowStockApparatusViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing low stock apparatus.
    """
    queryset = LowStockApparatus.objects.all()
    serializer_class = LowStockApparatusSerializer
