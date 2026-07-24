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
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    unit = serializers.SerializerMethodField()
    actual_used_quantity = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)

    class Meta:
        model = StockRequestChemicalItem
        fields = ['id', 'chemical_name', 'quantity', 'unit', 'actual_used_quantity']

    def get_unit(self, obj):
        return obj.unit


class StockRequestCreateSerializer(serializers.ModelSerializer):
    chemical_items = ChemicalItemWriteSerializer(many=True, required=True)
    date = serializers.DateField(required=False)
    hour = serializers.ListField(child=serializers.IntegerField(), required=True)

    class Meta:
        model = StockRequest
        fields = [
            'id', 'request_id', 'class_name', 'reason', 'date',
            'day_order', 'hour', 'purpose_type', 'experiment_name', 'student_name', 'venue',
            'chemical_items', 'status', 'created_at'
        ]
        read_only_fields = ['id', 'request_id', 'created_at']

    def validate(self, data):
        chemicals = data.get('chemical_items', [])
        if not chemicals:
            raise serializers.ValidationError(
                "At least one chemical item must be added"
            )
        hour = data.get('hour')
        if hour is not None and len(hour) == 0:
            raise serializers.ValidationError(
                {"hour": "At least one hour must be selected."}
            )
        user = self.context['request'].user
        today = timezone.now().date()
        date_val = data.get('date') or today
        if date_val < today:
            raise serializers.ValidationError(
                {"date": "Date cannot be in the past. Use today or a future date."}
            )
        data['date'] = date_val

        purpose_type = data.get('purpose_type')
        if purpose_type == 'practical_lab' and data.get('student_name'):
            raise serializers.ValidationError(
                {"student_name": "Student name must not be set when purpose is Practical Lab."}
            )
        if purpose_type == 'research_project' and not data.get('student_name'):
            raise serializers.ValidationError(
                {"student_name": "Student name is required for Research/Project."}
            )
        if purpose_type and not data.get('experiment_name'):
            raise serializers.ValidationError(
                {"experiment_name": "Experiment name is required."}
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

        return data

    def create(self, validated_data):
        chemical_items_data = validated_data.pop('chemical_items', [])
        validated_data['requested_by'] = self.context['request'].user
        stock_request = StockRequest.objects.create(**validated_data)

        for item_data in chemical_items_data:
            chem_name = item_data.get('chemical_name')
            try:
                chem = AvailableChemical.objects.get(chemical_name=chem_name)
                item_data['unit'] = chem.unit
            except AvailableChemical.DoesNotExist:
                pass
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
                chem_name = item_data.get('chemical_name')
                try:
                    chem = AvailableChemical.objects.get(chemical_name=chem_name)
                    item_data['unit'] = chem.unit
                except AvailableChemical.DoesNotExist:
                    pass
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
            'day_order', 'hour', 'purpose_type', 'experiment_name', 'student_name', 'venue',
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
            'day_order', 'hour', 'purpose_type', 'experiment_name', 'student_name', 'venue',
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
    source_request = serializers.SerializerMethodField()

    class Meta:
        model = IssueRegister
        fields = ['ir_id', 'request_code', 'stock_request_db_id', 'staff_name', 'class_field', 'date', 'status', 'chemicals', 'source_request']

    def get_source_request(self, obj):
        if not obj.stock_request_db_id:
            return None
        try:
            sr = StockRequest.objects.get(id=obj.stock_request_db_id)
            return {
                'day_order': sr.day_order,
                'hour': sr.hour,
                'purpose_type': sr.purpose_type,
                'experiment_name': sr.experiment_name,
                'student_name': sr.student_name,
                'venue': sr.venue,
            }
        except StockRequest.DoesNotExist:
            return None
