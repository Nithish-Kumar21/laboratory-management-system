from rest_framework import serializers
from .models import StockRequest, StockRequestChemicalItem, StockRequestApparatusItem


class ChemicalItemWriteSerializer(serializers.Serializer):
    chemical_name = serializers.CharField(max_length=64)
    quantity_ml = serializers.DecimalField(max_digits=10, decimal_places=2)

    def validate_quantity_ml(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value


class ApparatusItemWriteSerializer(serializers.Serializer):
    apparatus_name = serializers.CharField(max_length=64)
    quantity_pieces = serializers.IntegerField()

    def validate_quantity_pieces(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value


class ChemicalItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockRequestChemicalItem
        fields = ['id', 'chemical_name', 'quantity_ml']


class ApparatusItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockRequestApparatusItem
        fields = ['id', 'apparatus_name', 'quantity_pieces']


class StockRequestCreateSerializer(serializers.ModelSerializer):
    chemical_items = ChemicalItemWriteSerializer(many=True, required=False)
    apparatus_items = ApparatusItemWriteSerializer(many=True, required=False)

    class Meta:
        model = StockRequest
        fields = ['id', 'reason', 'chemical_items', 'apparatus_items', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']

    def validate(self, data):
        chemicals = data.get('chemical_items', [])
        apparatus = data.get('apparatus_items', [])
        if not chemicals and not apparatus:
            raise serializers.ValidationError(
                "At least one chemical or apparatus item must be added"
            )
        return data

    def create(self, validated_data):
        chemical_items_data = validated_data.pop('chemical_items', [])
        apparatus_items_data = validated_data.pop('apparatus_items', [])
        validated_data['requested_by'] = self.context['request'].user
        stock_request = StockRequest.objects.create(**validated_data)

        for item_data in chemical_items_data:
            StockRequestChemicalItem.objects.create(stock_request=stock_request, **item_data)
        for item_data in apparatus_items_data:
            StockRequestApparatusItem.objects.create(stock_request=stock_request, **item_data)

        return stock_request


class StockRequestListSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    requested_by_id = serializers.CharField(source='requested_by.employee_id', read_only=True)
    chemical_items = ChemicalItemSerializer(many=True, read_only=True)
    apparatus_items = ApparatusItemSerializer(many=True, read_only=True)

    class Meta:
        model = StockRequest
        fields = [
            'id', 'status', 'reason', 'created_at',
            'requested_by_name', 'requested_by_id',
            'chemical_items', 'apparatus_items'
        ]


class StockRequestDetailSerializer(serializers.ModelSerializer):
    chemical_items = ChemicalItemSerializer(many=True, read_only=True)
    apparatus_items = ApparatusItemSerializer(many=True, read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    requested_by_id = serializers.CharField(source='requested_by.employee_id', read_only=True)
    reviewed_by_name = serializers.CharField(
        source='reviewed_by.full_name', read_only=True, default=None
    )

    class Meta:
        model = StockRequest
        fields = [
            'id', 'status', 'reason', 'created_at',
            'requested_by_name', 'requested_by_id',
            'chemical_items', 'apparatus_items',
            'reviewed_at', 'reviewed_by_name'
        ]
