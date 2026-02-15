from rest_framework import serializers
from .models import StockRequest, StockRequestChemicalItem, StockRequestApparatusItem


class ChemicalItemWriteSerializer(serializers.Serializer):
    chemical_name = serializers.CharField(max_length=64)
    quantity_ml = serializers.DecimalField(max_digits=10, decimal_places=2)

    def validate_quantity_ml(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value


class ChemicalItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockRequestChemicalItem
        fields = ['id', 'chemical_name', 'quantity_ml']


class StockRequestCreateSerializer(serializers.ModelSerializer):
    chemical_items = ChemicalItemWriteSerializer(many=True, required=True)

    class Meta:
        model = StockRequest
        fields = ['id', 'request_id', 'class_name', 'reason', 'chemical_items', 'status', 'created_at']
        read_only_fields = ['id', 'request_id', 'created_at']

    def validate(self, data):
        chemicals = data.get('chemical_items', [])
        if not chemicals:
            raise serializers.ValidationError(
                "At least one chemical item must be added"
            )
        
        status = data.get('status', 'pending')
        user = self.context['request'].user
        
        if status == 'pending' and user.role == 'staff':
            # Check for existing pending request
            has_pending = StockRequest.objects.filter(
                requested_by=user, 
                status='pending'
            ).exists()
            if has_pending:
                raise serializers.ValidationError(
                    "You already have a pending request. Please wait for it to be reviewed or save this as a draft."
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
            'id', 'request_id', 'class_name', 'status', 'reason', 'created_at',
            'requested_by_name', 'requested_by_id',
            'chemical_items'
        ]


class StockRequestDetailSerializer(serializers.ModelSerializer):
    chemical_items = ChemicalItemSerializer(many=True, read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    requested_by_id = serializers.CharField(source='requested_by.employee_id', read_only=True)
    reviewed_by_name = serializers.CharField(
        source='reviewed_by.full_name', read_only=True, default=None
    )

    class Meta:
        model = StockRequest
        fields = [
            'id', 'request_id', 'class_name', 'status', 'reason', 'created_at', 'date',
            'requested_by_name', 'requested_by_id', 'requested_by',
            'chemical_items',
            'reviewed_at', 'reviewed_by_name'
        ]
