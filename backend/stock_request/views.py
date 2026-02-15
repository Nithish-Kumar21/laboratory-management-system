from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import StockRequest
from .serializers import (
    StockRequestCreateSerializer,
    StockRequestListSerializer,
    StockRequestDetailSerializer,
    StockRequestUpdateSerializer,
)
from .permissions import StockRequestPermission


class StockRequestViewSet(viewsets.ModelViewSet):
    queryset = StockRequest.objects.all()
    permission_classes = [StockRequestPermission]

    def get_serializer_class(self):
        if self.action == 'create':
            return StockRequestCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return StockRequestUpdateSerializer
        elif self.action in ['retrieve', 'accept', 'reject']:
            return StockRequestDetailSerializer
        return StockRequestListSerializer

    @action(detail=False, methods=['get'])
    def pending_count(self, request):
        if request.user.role != 'hod':
            return Response({'count': 0})
        count = StockRequest.objects.filter(status='pending').count()
        return Response({'count': count})

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.user.role
        status_filter = self.request.query_params.get('status')
        
        if role == 'staff':
            qs = qs.filter(requested_by=self.request.user)
            if status_filter in ('draft', 'pending', 'accepted', 'rejected'):
                return qs.filter(status=status_filter)
            # Default for staff LIST: hide drafts (unless retrieve action)
            if self.action == 'list':
                return qs.exclude(status='draft')
            return qs
        
        if role == 'hod':
            # HOD can also have their own drafts
            if status_filter == 'draft':
                return qs.filter(requested_by=self.request.user, status='draft')

            if self.action == 'list':
                # HOD should primarily see others' requests for approval
                if status_filter == 'pending' or not status_filter:
                    qs = qs.exclude(requested_by=self.request.user)
                    
                if status_filter == 'all':
                    return qs.exclude(status='draft')
                if status_filter in ('pending', 'accepted', 'rejected'):
                    return qs.filter(status=status_filter)
                # Default to pending for HOD if no specific history group requested
                return qs.filter(status='pending')
            
            # For retrieve or other actions, allow access (standard permissions handle isolation)
            return qs

        if status_filter in ('draft', 'pending', 'accepted', 'rejected'):
            return qs.filter(status=status_filter)
        if self.action == 'list':
            return qs.exclude(status='draft')
        return qs

    @action(detail=False, methods=['get'], url_path='reviewed')
    def reviewed_requests(self, request):
        """Get unviewed reviewed requests (accepted/rejected) for staff notifications"""
        user = request.user
        role = getattr(user, 'role', None)
        
        # Only for staff members
        if role != 'staff':
            return Response([], status=status.HTTP_200_OK)
        
        # Get requests that have been reviewed but not yet viewed by requester
        reviewed = StockRequest.objects.filter(
            requested_by=user,
            status__in=['accepted', 'rejected'],
            viewed_by_requester=False
        ).order_by('-reviewed_at')[:10]  # Last 10 unviewed reviewed requests
        
        serializer = self.get_serializer(reviewed, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save()

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to mark as viewed when requester accesses detail page"""
        instance = self.get_object()
        
        # Mark as viewed if the requester is viewing their own reviewed request
        if (request.user == instance.requested_by and 
            instance.status in ['accepted', 'rejected'] and 
            not instance.viewed_by_requester):
            instance.viewed_by_requester = True
            instance.save(update_fields=['viewed_by_requester'])
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Move a draft request to pending status"""
        obj = self.get_object()
        if obj.requested_by != request.user:
            return Response(
                {'error': 'You can only submit your own drafts'},
                status=status.HTTP_403_FORBIDDEN
            )
        if obj.status != 'draft':
            return Response(
                {'error': f'Cannot submit a request that is already {obj.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for existing pending request
        has_pending = StockRequest.objects.filter(
            requested_by=request.user, 
            status='pending'
        ).exists()
        if has_pending:
            return Response(
                {'error': 'You already have a pending request. Please wait for it to be reviewed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        obj.status = 'pending'
        obj.save()
        return Response(StockRequestDetailSerializer(obj).data)

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
