from rest_framework import serializers
from django.utils import timezone
from .models import StockRequest, StockRequestChemicalItem, StockRequestApparatusItem, IssueRegister, IssueChemicals
from inventory.models import AvailableChemical


class ChemicalItemWriteSerializer(serializers.Serializer):
    chemical_name = serializers.CharField(max_length=64)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value


class ChemicalItemSerializer(serializers.ModelSerializer):
    unit = serializers.SerializerMethodField()

    class Meta:
        model = StockRequestChemicalItem
        fields = ['id', 'chemical_name', 'quantity', 'unit', 'actual_used_quantity']

    def get_unit(self, obj):
        return obj.unit


class StockRequestCreateSerializer(serializers.ModelSerializer):
    chemical_items = ChemicalItemWriteSerializer(many=True, required=True)
    date = serializers.DateField(required=False)

    class Meta:
        model = StockRequest
        fields = ['id', 'request_id', 'class_name', 'reason', 'date', 'chemical_items', 'status', 'created_at']
        read_only_fields = ['id', 'request_id', 'created_at']

    def validate(self, data):
        chemicals = data.get('chemical_items', [])
        if not chemicals:
            raise serializers.ValidationError(
                "At least one chemical item must be added"
            )
        user = self.context['request'].user
        today = timezone.now().date()
        date_val = data.get('date') or today
        if date_val < today:
            raise serializers.ValidationError(
                {"date": "Date cannot be in the past. Use today or a future date."}
            )
        data['date'] = date_val
        if user.role == 'staff':
            class_name = data.get('class_name', '')
            dept = user.department or ''
            if 'B.Sc' in dept and 'B.Sc' not in class_name:
                raise serializers.ValidationError(
                    {"class_name": "Class must belong to your department (B.Sc Chemistry)."}
                )
            if 'M.Sc' in dept and 'M.Sc' not in class_name:
                raise serializers.ValidationError(
                    {"class_name": "Class must belong to your department (M.Sc Chemistry)."}
                )
        for item in chemicals:
            chem_name = item.get('chemical_name')
            qty = item.get('quantity')
            if chem_name and qty:
                try:
                    chem = AvailableChemical.objects.get(chemical_name=chem_name)
                    if qty > chem.quantity:
                        raise serializers.ValidationError(
                            f"Requested quantity for '{chem_name}' exceeds available stock (Available: {chem.quantity})"
                        )
                except AvailableChemical.DoesNotExist:
                    pass

        status = data.get('status', 'pending')
        if status == 'pending' and user.role == 'staff':
            active_statuses = ['pending', 'accepted', 'issued', 'reported']
            has_active = StockRequest.objects.filter(
                requested_by=user,
                status__in=active_statuses
            ).exists()
            if has_active:
                raise serializers.ValidationError(
                    "You already have an active request. Complete your previous request first, or save this as a draft."
                )
        return data

    def create(self, validated_data):
        chemical_items_data = validated_data.pop('chemical_items', [])
        validated_data['requested_by'] = self.context['request'].user
        stock_request = StockRequest.objects.create(**validated_data)

        for item_data in chemical_items_data:
            StockRequestChemicalItem.objects.create(stock_request=stock_request, **item_data)

        return stock_request


class StockRequestUpdateSerializer(StockRequestCreateSerializer):
    def update(self, instance, validated_data):
        chemical_items_data = validated_data.pop('chemical_items', None)
        
        # Update fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # If status is changing to pending (re-request), clear reviewer info
        if validated_data.get('status') == 'pending':
            instance.reviewed_by = None
            instance.reviewed_at = None
            instance.viewed_by_requester = False
            
        instance.save()

        # Update chemicals if provided
        if chemical_items_data is not None:
            # Delete old items
            instance.chemical_items.all().delete()
            # Create new items
            for item_data in chemical_items_data:
                StockRequestChemicalItem.objects.create(stock_request=instance, **item_data)

        return instance


class StockRequestListSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    requested_by_id = serializers.CharField(source='requested_by.employee_id', read_only=True)
    chemical_items = ChemicalItemSerializer(many=True, read_only=True)

    class Meta:
        model = StockRequest
        fields = [
            'id', 'request_id', 'class_name', 'status', 'reason', 'date', 'created_at',
            'requested_by_name', 'requested_by_id',
            'chemical_items',
            'issued_at', 'reported_at', 'completed_at',
        ]


class StockRequestDetailSerializer(serializers.ModelSerializer):
    chemical_items = ChemicalItemSerializer(many=True, read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    requested_by_id = serializers.CharField(source='requested_by.employee_id', read_only=True)
    reviewed_by_name = serializers.CharField(
        source='reviewed_by.full_name', read_only=True, default=None
    )
    issued_by_name = serializers.CharField(
        source='issued_by.full_name', read_only=True, default=None
    )

    class Meta:
        model = StockRequest
        fields = [
            'id', 'request_id', 'class_name', 'status', 'reason', 'rejection_reason', 'created_at', 'date',
            'requested_by_name', 'requested_by_id', 'requested_by',
            'chemical_items',
            'reviewed_at', 'reviewed_by_name',
            'issued_at', 'issued_by_name',
            'reported_at', 'completed_at',
        ]


class UsageReportItemSerializer(serializers.Serializer):
    """Serializer for each item's actual usage report."""
    id = serializers.IntegerField()
    actual_used_quantity = serializers.DecimalField(max_digits=10, decimal_places=2)

    def validate_actual_used_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Actual used quantity cannot be negative")
        return value


class UsageReportSerializer(serializers.Serializer):
    """Serializer for staff usage reporting."""
    items = UsageReportItemSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item must be reported")
        return value


class IssueChemicalsSerializer(serializers.ModelSerializer):
    returned = serializers.ReadOnlyField()
    additional = serializers.ReadOnlyField()
    unit = serializers.SerializerMethodField()

    class Meta:
        model = IssueChemicals
        fields = ['id', 'chemical_name', 'issued_quantity', 'unit', 'actual_usage', 'returned', 'additional']

    def get_unit(self, obj):
        return obj.unit


class IssueRegisterSerializer(serializers.ModelSerializer):
    chemicals = IssueChemicalsSerializer(many=True, read_only=True)

    class Meta:
        model = IssueRegister
        fields = ['ir_id', 'request_code', 'stock_request_db_id', 'staff_name', 'class_field', 'date', 'status', 'chemicals']
