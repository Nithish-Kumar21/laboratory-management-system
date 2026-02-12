from rest_framework import serializers
from .models import StockRegister, ChemicalItem, ApparatusItem
from inventory.models import AvailableChemical, AvailableApparatus



# Read-only serializers (existing + NEW 'make' field)
class ChemicalItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChemicalItem
        fields = ['id', 'chemical_name', 'make', 'quantity_ml', 'rate']  # Added 'make'



class ApparatusItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApparatusItem
        fields = ['id', 'apparatus_name', 'make', 'quantity_pieces', 'rate']  # Added 'make'



class StockRegisterListSerializer(serializers.ModelSerializer):
    """Serializer for list view - just basic info"""
    class Meta:
        model = StockRegister
        fields = ['id', 'invoice_number', 'date', 'supplier_name']  # Added 'supplier_name'



class StockRegisterDetailSerializer(serializers.ModelSerializer):
    """Serializer for detail view - includes related items"""
    chemical_items = ChemicalItemSerializer(many=True, read_only=True)
    apparatus_items = ApparatusItemSerializer(many=True, read_only=True)


    class Meta:
        model = StockRegister
        fields = ['id', 'invoice_number', 'date', 'supplier_name', 'chemical_items', 'apparatus_items']  # Added 'supplier_name'



# Write serializers (NEW + 'make' field)
class ChemicalItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChemicalItem
        fields = ['chemical_name', 'make', 'quantity_ml', 'rate']  # Added 'make'
    
    def validate_quantity_ml(self, value):
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
        fields = ['apparatus_name', 'make', 'quantity_pieces', 'rate']  # Added 'make'
    
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
        fields = ['invoice_number', 'date', 'supplier_name', 'chemical_items', 'apparatus_items']  # Added 'supplier_name'
    
    def validate_invoice_number(self, value):
        if StockRegister.objects.filter(invoice_number=value).exists():
            raise serializers.ValidationError("Invoice number already exists")
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
        
        # Create chemical items and add to inventory
        for item_data in chemical_items_data:
            chem_item = ChemicalItem.objects.create(stock_register=stock_register, **item_data)
            available, _ = AvailableChemical.objects.get_or_create(
                chemical_name=chem_item.chemical_name,
                defaults={'available_quantity_ml': 0, 'reorder_level': 0}
            )
            available.available_quantity_ml += chem_item.quantity_ml
            available.save()
        
        # Create apparatus items and add to inventory
        for item_data in apparatus_items_data:
            app_item = ApparatusItem.objects.create(stock_register=stock_register, **item_data)
            available, _ = AvailableApparatus.objects.get_or_create(
                apparatus_name=app_item.apparatus_name,
                defaults={'available_quantity_pieces': 0, 'reorder_level': 0}
            )
            available.available_quantity_pieces += app_item.quantity_pieces
            available.save()
        
        return stock_register
