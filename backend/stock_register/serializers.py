from rest_framework import serializers
from django.utils import timezone
from .models import StockRegister, ChemicalItem, ApparatusItem
from inventory.models import AvailableChemical, AvailableApparatus



# Read-only serializers (existing + NEW 'make' field)
class ChemicalItemSerializer(serializers.ModelSerializer):
    unit = serializers.SerializerMethodField()

    class Meta:
        model = ChemicalItem
        fields = ['id', 'chemical_name', 'make', 'quantity', 'unit', 'rate']

    def get_unit(self, obj):
        return obj.unit



class ApparatusItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApparatusItem
        fields = ['id', 'apparatus_name', 'make', 'quantity_pieces', 'rate']



class StockRegisterListSerializer(serializers.ModelSerializer):
    """Serializer for list view - basic info + item counts for list display"""
    chemical_items_count = serializers.SerializerMethodField()
    apparatus_items_count = serializers.SerializerMethodField()

    class Meta:
        model = StockRegister
        fields = ['id', 'invoice_number', 'date', 'supplier_name', 'chemical_items_count', 'apparatus_items_count']

    def get_chemical_items_count(self, obj):
        return obj.chemical_items.count()

    def get_apparatus_items_count(self, obj):
        return obj.apparatus_items.count()



class StockRegisterDetailSerializer(serializers.ModelSerializer):
    """Serializer for detail view - includes related items"""
    chemical_items = ChemicalItemSerializer(many=True, read_only=True)
    apparatus_items = ApparatusItemSerializer(many=True, read_only=True)


    class Meta:
        model = StockRegister
        fields = ['id', 'invoice_number', 'date', 'supplier_name', 'chemical_items', 'apparatus_items']



# Write serializers
class ChemicalItemWriteSerializer(serializers.ModelSerializer):
    unit = serializers.SerializerMethodField()

    class Meta:
        model = ChemicalItem
        fields = ['chemical_name', 'make', 'quantity', 'unit', 'rate']
    
    def get_unit(self, obj):
        return obj.unit

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value
    
    def validate_rate(self, value):
        if value <= 0:
            raise serializers.ValidationError("Rate must be greater than 0")
        return value



class ApparatusItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApparatusItem
        fields = ['apparatus_name', 'make', 'quantity_pieces', 'rate']
    
    def validate_quantity_pieces(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value
    
    def validate_rate(self, value):
        if value <= 0:
            raise serializers.ValidationError("Rate must be greater than 0")
        return value



class StockRegisterCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new stock register entries with nested items"""
    chemical_items = ChemicalItemWriteSerializer(many=True, required=False)
    apparatus_items = ApparatusItemWriteSerializer(many=True, required=False)


    class Meta:
        model = StockRegister
        fields = ['invoice_number', 'date', 'supplier_name', 'chemical_items', 'apparatus_items']
    
    def validate_invoice_number(self, value):
        if StockRegister.objects.filter(invoice_number=value).exists():
            raise serializers.ValidationError("Invoice number already exists")
        return value
    
    def validate_date(self, value):
        if value > timezone.now().date():
            raise serializers.ValidationError("Invoice date cannot be in the future.")
        return value
    
    def validate(self, data):
        # At least one item (chemical or apparatus) must be provided
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
        
        # Create stock register entry (now includes supplier_name)
        stock_register = StockRegister.objects.create(**validated_data)
        
        # Create individual items
        # NOTE: Database triggers 'chemical_item_after_insert' and 'apparatus_item_after_insert' 
        # handle the actual updating of AvailableChemical and AvailableApparatus quantities.
        # Manual updates here would cause double-counting.
        
        for item_data in chemical_items_data:
            ChemicalItem.objects.create(stock_register=stock_register, **item_data)
        
        for item_data in apparatus_items_data:
            ApparatusItem.objects.create(stock_register=stock_register, **item_data)
        
        return stock_register
