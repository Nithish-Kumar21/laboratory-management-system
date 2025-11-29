from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import DamagedEntry, DamagedItem
from .serializers import (
    DamagedEntryListSerializer, 
    DamagedEntryDetailSerializer,
    DamagedEntryCreateSerializer
)
from inventory.models import AvailableApparatus  # ✅ Add this import


class DamagedEntryViewSet(viewsets.ModelViewSet):
    """
    API endpoint for damaged entry records.
    Supports: GET (list), GET (detail), POST (create)
    """
    queryset = DamagedEntry.objects.all().order_by('-date')
    
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
            print("Validation errors:", serializer.errors)  # Debug print
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            print("Error creating damaged entry:", str(e))  # Debug print
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def apparatus_names(self, request):
        """Get list of apparatus names from inventory for autocomplete"""
        names = AvailableApparatus.objects.values_list('apparatus_name', flat=True).distinct().order_by('apparatus_name')
        return Response(list(names))
