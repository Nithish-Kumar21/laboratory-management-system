from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import StockRequest, StockRequestChemicalItem, IssueRegister, IssueChemicals
from .serializers import (
    StockRequestCreateSerializer,
    StockRequestListSerializer,
    StockRequestDetailSerializer,
    StockRequestUpdateSerializer,
    UsageReportSerializer,
    IssueRegisterSerializer,
)
from .permissions import StockRequestPermission
from inventory.models import AvailableChemical


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

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # Allow editing in draft or rejected so staff can fix and resubmit
        if instance.status not in ('draft', 'rejected'):
            return Response(
                {'error': 'Only draft or rejected requests can be edited.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status not in ('draft', 'rejected'):
            return Response(
                {'error': 'Only draft or rejected requests can be edited.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Staff can delete before HOD approval or after rejection
        if instance.status not in ('draft', 'pending', 'rejected'):
            return Response(
                {'error': 'Requests can only be deleted before approval or when rejected.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

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
        
        # 1. Handle Drafts specifically (always personal)
        if status_filter == 'draft':
            return qs.filter(requested_by=self.request.user, status='draft')

        # 2. Role-based Filtering
        if role == 'staff':
            # Staff: "THEIR forms only"
            qs = qs.filter(requested_by=self.request.user)
            if self.action == 'list':
                if status_filter == 'all' or not status_filter:
                    return qs.exclude(status='draft')
                return qs.filter(status=status_filter)
            return qs
        
        if role == 'hod':
            if self.action == 'list':
                if status_filter == 'all':
                    # HOD: "their approved/rejected forms only"
                    return qs.filter(reviewed_by=self.request.user).exclude(status='draft')
                
                if status_filter in ('pending', None):
                    # Others' pending requests for approval
                    return qs.filter(status='pending').exclude(requested_by=self.request.user)
                
                # If they explicitly filter by a history status, show only those THEY handled
                if status_filter in ('accepted', 'rejected', 'issued', 'reported', 'completed'):
                    return qs.filter(status=status_filter, reviewed_by=self.request.user)
                
                return qs.filter(status=status_filter)
            return qs

        if role == 'store_keeper':
            if self.action == 'list':
                if status_filter == 'all':
                    # Store Keeper: "their issued forms only"
                    return qs.filter(issued_by=self.request.user).exclude(status='draft')
                
                if status_filter in ('accepted', None):
                    # Default: All approved requests waiting to be issued
                    return qs.filter(status='accepted')
                
                # If they explicitly filter by history (issued/reported/completed), show only theirs
                if status_filter in ('issued', 'reported', 'completed'):
                    return qs.filter(status=status_filter, issued_by=self.request.user)
                
                return qs.filter(status=status_filter)
            return qs

        # Default for admin or other roles
        if status_filter == 'all' or not status_filter:
            return qs.exclude(status='draft')
        return qs.filter(status=status_filter)

    @action(detail=True, methods=['post'])
    def mark_as_issued(self, request, pk=None):
        if request.user.role not in ['store_keeper', 'admin']:
            return Response(
                {'error': 'Only store keeper or admin can mark requests as issued'},
                status=status.HTTP_403_FORBIDDEN
            )
        obj = self.get_object()
        if obj.status != 'accepted':
            return Response(
                {'error': f'Only approved requests can be marked as issued. Current status: {obj.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj.status = 'issued'
        obj.issued_at = timezone.now()
        obj.issued_by = request.user
        obj.save()

        return Response(StockRequestDetailSerializer(obj).data)

    @action(detail=True, methods=['post'])
    def report_usage(self, request, pk=None):
        """
        Staff reports actual usage of chemicals.
        """
        obj = self.get_object()
        if obj.requested_by != request.user:
            return Response({'error': 'You can only report usage for your own requests'}, status=status.HTTP_403_FORBIDDEN)
        
        if obj.status != 'issued':
            return Response({'error': f'Cannot report usage for request with status {obj.status}'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = UsageReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        reported_items = {item['id']: item['actual_used_quantity'] for item in serializer.validated_data['items']}
        
        # Verify all items in the request are being reported
        request_items = {item.id for item in obj.chemical_items.all()}
        if not set(reported_items.keys()).issubset(request_items):
             return Response({'error': 'Invalid item IDs provided'}, status=status.HTTP_400_BAD_REQUEST)

        # Update items with actual usage
        for item in obj.chemical_items.all():
            if item.id in reported_items:
                item.actual_used_quantity = reported_items[item.id]
                item.save()
        
        obj.status = 'reported'
        obj.reported_at = timezone.now()
        obj.save()

        return Response(StockRequestDetailSerializer(obj).data)


    @action(detail=True, methods=['post'])
    def mark_as_completed(self, request, pk=None):
        """
        Store Keeper marks request as completed, adjusts inventory, and logs to issue register.
        """
        if request.user.role not in ['store_keeper', 'admin']:
             return Response({'error': 'Only store keeper can complete requests'}, status=status.HTTP_403_FORBIDDEN)

        obj = self.get_object()
        if obj.status != 'reported':
             return Response({'error': 'Request must be in "reported" status to complete'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Create Issue Register Entry
        issue_register = IssueRegister.objects.create(
            request_code=obj.request_id,
            stock_request_db_id=obj.pk,
            staff_name=obj.requested_by.full_name,
            class_field=obj.class_name,
            date=obj.date,
            status='completed'
        )

        # 2. Process Items and Reduce Inventory
        for item in obj.chemical_items.all():
            actual = item.actual_used_quantity if item.actual_used_quantity is not None else item.quantity
            requested = item.quantity

            # Log item to legacy table 'issue_chemicals'
            IssueChemicals.objects.create(
                ir=issue_register,
                chemical_name=item.chemical_name,
                unit=item.unit,
                issued_quantity=requested,
                actual_usage=actual
            )

            # Reduce Inventory by actual used quantity
            try:
                stock_item = AvailableChemical.objects.get(chemical_name=item.chemical_name)
                stock_item.quantity -= actual
                stock_item.save()
            except AvailableChemical.DoesNotExist:
                pass

        obj.status = 'completed'
        obj.completed_at = timezone.now()
        obj.save()

        return Response(StockRequestDetailSerializer(obj).data)

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
        
        # Check for existing active request
        active_statuses = ['pending', 'accepted', 'issued', 'reported']
        has_active = StockRequest.objects.filter(
            requested_by=request.user, 
            status__in=active_statuses
        ).exists()
        if has_active:
            return Response(
                {'error': 'You already have an active request. Complete your previous request first.'},
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
        rejection_reason = (request.data.get('rejection_reason') or '').strip()
        if not rejection_reason:
            return Response(
                {'error': 'Reason for rejection is required.', 'rejection_reason': ['This field is required.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj = self.get_object()
        if obj.status != 'pending':
            return Response(
                {'error': f'Request is already {obj.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj.status = 'rejected'
        obj.rejection_reason = rejection_reason
        obj.reviewed_at = timezone.now()
        obj.reviewed_by = request.user
        obj.save()
        return Response(StockRequestDetailSerializer(obj).data)


class IssueRegisterViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for issue register entries.
    List view: Shows issue ID, staff name, class, date, and status.
    Detail view: Includes all chemical items with usage details.
    List supports ?ordering=date|-date|ir_id|-ir_id|staff_name|-staff_name for sorting.
    """
    queryset = IssueRegister.objects.all()
    serializer_class = IssueRegisterSerializer
    # Using the same permission as StockRequest for now (basically authenticated)
    permission_classes = [StockRequestPermission]
    ordering_fields = ['date', 'ir_id', 'staff_name']

    def get_queryset(self):
        qs = super().get_queryset()
        ordering = self.request.query_params.get('ordering')
        if ordering in ('date', '-date', 'ir_id', '-ir_id', 'staff_name', '-staff_name'):
            return qs.order_by(ordering)
        return qs.order_by('-date')
