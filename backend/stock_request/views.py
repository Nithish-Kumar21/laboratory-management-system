from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django.db import transaction
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
from audit.services import AuditLogService


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
                    return qs.exclude(status__in=['draft', 'completed'])
                return qs.filter(status=status_filter)
            return qs
        
        if role == 'hod':
            if self.action == 'list':
                if status_filter == 'all':
                    # HOD: "their approved/rejected forms only"
                    return qs.filter(reviewed_by=self.request.user).exclude(status__in=['draft', 'completed'])
                
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
                    return qs.filter(issued_by=self.request.user).exclude(status__in=['draft', 'completed'])
                
                if status_filter in ('accepted', None):
                    # Default: All approved requests waiting to be issued or completed
                    return qs.filter(status__in=['accepted', 'reported'])
                
                # If they explicitly filter by history (issued/reported/completed), show only theirs
                if status_filter in ('issued', 'reported', 'completed'):
                    return qs.filter(status=status_filter, issued_by=self.request.user)
                
                return qs.filter(status=status_filter)
            return qs

        # Default for admin or other roles
        if status_filter == 'all' or not status_filter:
            return qs.exclude(status__in=['draft', 'completed'])
        return qs.filter(status=status_filter)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def mark_as_issued(self, request, pk=None):
        if request.user.role not in ['store_keeper', 'admin']:
            return Response(
                {'success': False, 'error': 'Only store keeper or admin can mark requests as issued'},
                status=status.HTTP_403_FORBIDDEN
            )
        obj = self.get_object()
        if obj.status == 'issued':
            return Response(
                {'success': True, 'data': {'message': 'Already issued.'}},
                status=status.HTTP_200_OK
            )
        if obj.status != 'accepted':
            return Response(
                {'success': False, 'error': f'Only accepted requests can be marked as issued. Current status: {obj.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        for item in obj.chemical_items.all():
            try:
                chem = AvailableChemical.objects.select_for_update().get(
                    chemical_name__iexact=item.chemical_name
                )
                if chem.quantity < item.quantity:
                    return Response(
                        {'success': False, 'error': f'Insufficient stock for {item.chemical_name}. Available: {chem.quantity}, Requested: {item.quantity}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                chem.quantity -= item.quantity
                chem.save()
            except AvailableChemical.DoesNotExist:
                return Response(
                    {'success': False, 'error': f'Chemical {item.chemical_name} not found in inventory'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        obj.status = 'issued'
        obj.issued_at = timezone.now()
        obj.issued_by = request.user
        obj.save()

        AuditLogService.log(
            user=request.user,
            action='REQUEST_ISSUED',
            entity_type='StockRequest',
            entity_id=obj.id,
            description=f'Request {obj.request_id} issued by {request.user.full_name}',
            request=request,
        )
        return Response(StockRequestDetailSerializer(obj).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def report_usage(self, request, pk=None):
        """
        Staff reports actual usage of chemicals.
        """
        obj = self.get_object()
        if obj.requested_by != request.user:
            return Response({'success': False, 'error': 'You can only report usage for your own requests'}, status=status.HTTP_403_FORBIDDEN)
        
        if obj.status == 'reported':
            return Response(
                {'success': True, 'data': {'message': 'Usage already reported.'}},
                status=status.HTTP_200_OK
            )
        if obj.status != 'issued':
            return Response({'success': False, 'error': f'Usage can only be reported for issued requests. Current status: {obj.status}'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = UsageReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'success': False, 'error': 'Invalid data', 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        reported_items = {item['id']: item['actual_used_quantity'] for item in serializer.validated_data['items']}
        
        # Verify all items in the request are being reported
        request_items = {item.id for item in obj.chemical_items.all()}
        if not set(reported_items.keys()).issubset(request_items):
             return Response({'success': False, 'error': 'Invalid item IDs provided'}, status=status.HTTP_400_BAD_REQUEST)

        # Update items with actual usage
        for item in obj.chemical_items.all():
            if item.id in reported_items:
                item.actual_used_quantity = reported_items[item.id]
                item.save()
        
        obj.status = 'reported'
        obj.reported_at = timezone.now()
        obj.save()

        AuditLogService.log(
            user=request.user,
            action='USAGE_REPORTED',
            entity_type='StockRequest',
            entity_id=obj.id,
            description=f'Usage reported for request {obj.request_id} by {request.user.full_name}',
            request=request,
        )
        return Response(StockRequestDetailSerializer(obj).data)


    @action(detail=True, methods=['post'])
    @transaction.atomic
    def mark_as_completed(self, request, pk=None):
        """
        Store Keeper marks request as completed, adjusts inventory, and logs to issue register.
        """
        if request.user.role not in ['store_keeper', 'admin']:
             return Response({'success': False, 'error': 'Only store keeper can complete requests'}, status=status.HTTP_403_FORBIDDEN)

        obj = self.get_object()
        if obj.status == 'completed':
            return Response(
                {'success': True, 'data': {'message': 'Already completed.'}},
                status=status.HTTP_200_OK
            )
        if obj.status != 'reported':
             return Response({'success': False, 'error': 'Only reported requests can be completed.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Create Issue Register Entry
        issue_register = IssueRegister.objects.create(
            request_code=obj.request_id,
            stock_request_db_id=obj.pk,
            staff_name=obj.requested_by.full_name,
            class_field=obj.class_name,
            date=obj.date,
            status='completed',
            venue=obj.venue
        )

        # 2. Process Items and Apply Delta to Inventory
        for item in obj.chemical_items.all():
            actual = item.actual_used_quantity if item.actual_used_quantity is not None else item.quantity
            requested = item.quantity

            # Log item to legacy table 'issue_chemicals'
            ic = IssueChemicals.objects.create(
                ir=issue_register,
                chemical_name=item.chemical_name,
                issued_quantity=requested,
                unit=item.unit,
                actual_usage=actual
            )

            # Apply delta: add returned, deduct additional (with select_for_update)
            try:
                stock_item = AvailableChemical.objects.select_for_update().get(
                    chemical_name__iexact=item.chemical_name
                )
                stock_item.quantity += ic.returned
                stock_item.quantity -= ic.additional
                stock_item.save()
            except AvailableChemical.DoesNotExist:
                pass

        obj.status = 'completed'
        obj.completed_at = timezone.now()
        obj.save()

        AuditLogService.log(
            user=request.user,
            action='REQUEST_COMPLETED',
            entity_type='StockRequest',
            entity_id=obj.id,
            description=f'Request {obj.request_id} completed by {request.user.full_name}',
            request=request,
        )
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

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        # TOCTOU fix: lock active requests before creating to prevent
        # two simultaneous creates from both passing the "no active request" check.
        if user.role == 'staff':
            active_statuses = ['pending', 'accepted', 'issued', 'reported']
            active_requests = StockRequest.objects.select_for_update().filter(
                requested_by=user,
                status__in=active_statuses,
            )
            if active_requests.exists():
                raise ValidationError(
                    "You already have an active request. Complete your previous request first, or save this as a draft."
                )

        # Generate request_id inside the same atomic block to prevent
        # concurrent requests from colliding on the manual sequence number.
        # Lock the latest request for the current year to serialize ID assignment.
        from django.utils import timezone
        from django.db import IntegrityError
        current_year = timezone.now().year
        last_request = StockRequest.objects.select_for_update().filter(
            created_at__year=current_year
        ).order_by('-request_id').first()

        if last_request and last_request.request_id:
            try:
                last_sequence = int(last_request.request_id.split('-')[-1])
                sequence_number = last_sequence + 1
            except (ValueError, IndexError):
                sequence_number = StockRequest.objects.filter(
                    created_at__year=current_year
                ).count() + 1
        else:
            sequence_number = 1

        request_id = f"REQ-{current_year}-{sequence_number:03d}"

        # Pass generated ID to serializer so model.save() doesn't re-generate
        try:
            instance = serializer.save(request_id=request_id)
        except IntegrityError:
            # Fallback: unique constraint violation (extremely rare, e.g. if
            # another transaction committed between our lock and insert).
            raise ValidationError(
                "A request is already in progress, please try again."
            )

        AuditLogService.log(
            user=self.request.user,
            action='REQUEST_CREATED',
            entity_type='StockRequest',
            entity_id=instance.id,
            description=f'Stock request created by {self.request.user.full_name}',
            request=self.request,
        )

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
                {'success': False, 'error': 'You can only submit your own drafts'},
                status=status.HTTP_403_FORBIDDEN
            )
        if obj.status == 'pending':
            return Response(
                {'success': True, 'data': {'message': 'Already submitted.'}},
                status=status.HTTP_200_OK
            )
        if obj.status != 'draft':
            return Response(
                {'success': False, 'error': f'Cannot submit a request that is already {obj.status}'},
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
                {'success': False, 'error': 'You already have an active request. Complete your previous request first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        obj.status = 'pending'
        obj.save()
        AuditLogService.log(
            user=request.user,
            action='REQUEST_SUBMITTED',
            entity_type='StockRequest',
            entity_id=obj.id,
            description=f'Request {obj.request_id} submitted by {request.user.full_name}',
            request=request,
        )
        return Response(StockRequestDetailSerializer(obj).data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        if request.user.role != 'hod':
            return Response(
                {'success': False, 'error': 'Only HOD can accept requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        obj = self.get_object()
        if obj.status == 'accepted':
            return Response(
                {'success': True, 'data': {'message': 'Already accepted.'}},
                status=status.HTTP_200_OK
            )
        if obj.status != 'pending':
            return Response(
                {'success': False, 'error': 'Only pending requests can be accepted.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj.status = 'accepted'
        obj.reviewed_at = timezone.now()
        obj.reviewed_by = request.user
        obj.save()
        AuditLogService.log(
            user=request.user,
            action='REQUEST_ACCEPTED',
            entity_type='StockRequest',
            entity_id=obj.id,
            description=f'Request {obj.request_id} accepted by {request.user.full_name}',
            request=request,
        )
        return Response(StockRequestDetailSerializer(obj).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if request.user.role != 'hod':
            return Response(
                {'success': False, 'error': 'Only HOD can reject requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        rejection_reason = (request.data.get('rejection_reason') or '').strip()
        if not rejection_reason:
            return Response(
                {'success': False, 'error': 'Reason for rejection is required.', 'rejection_reason': ['This field is required.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj = self.get_object()
        if obj.status == 'rejected':
            return Response(
                {'success': True, 'data': {'message': 'Already rejected.'}},
                status=status.HTTP_200_OK
            )
        if obj.status != 'pending':
            return Response(
                {'success': False, 'error': 'Only pending requests can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj.status = 'rejected'
        obj.rejection_reason = rejection_reason
        obj.reviewed_at = timezone.now()
        obj.reviewed_by = request.user
        obj.save()
        AuditLogService.log(
            user=request.user,
            action='REQUEST_REJECTED',
            entity_type='StockRequest',
            entity_id=obj.id,
            description=f'Request {obj.request_id} rejected by {request.user.full_name}. Reason: {rejection_reason}',
            request=request,
        )
        return Response(StockRequestDetailSerializer(obj).data)


    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a pending request"""
        obj = self.get_object()
        if obj.requested_by != request.user:
            return Response(
                {'success': False, 'error': 'You can only cancel your own requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        if obj.status == 'cancelled':
            return Response(
                {'success': True, 'data': {'message': 'Already cancelled.'}},
                status=status.HTTP_200_OK
            )
        if obj.status != 'pending':
            return Response(
                {'success': False, 'error': 'Only pending requests can be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj.status = 'cancelled'
        obj.save()
        AuditLogService.log(
            user=request.user,
            action='REQUEST_CANCELLED',
            entity_type='StockRequest',
            entity_id=obj.id,
            description=f'Request {obj.request_id} cancelled by {request.user.full_name}',
            request=request,
        )
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
