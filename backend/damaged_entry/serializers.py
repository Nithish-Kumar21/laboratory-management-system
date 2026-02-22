from rest_framework import serializers
from .models import DamagedEntry, DamagedItem


# Read-only serializers (existing)
class DamagedItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DamagedItem
        fields = ['id', 'apparatus_name', 'quantity', 'caused_by']


class DamagedEntryListSerializer(serializers.ModelSerializer):
    """Serializer for list view - basic info only"""
    # Just list fields - no explicit declaration needed
    
    class Meta:
        model = DamagedEntry
        fields = ['id', 'staff', 'class_name', 'date']



class DamagedEntryDetailSerializer(serializers.ModelSerializer):
    """Serializer for detail view - includes damaged items"""
    damaged_items = DamagedItemSerializer(many=True, read_only=True)

    class Meta:
        model = DamagedEntry
        fields = ['id', 'staff', 'class_name', 'date', 'details', 'damaged_items']


# Write serializers (NEW)
class DamagedItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DamagedItem
        fields = ['apparatus_name', 'quantity', 'caused_by']

    def validate(self, data):
        apparatus_name = data.get('apparatus_name')
        quantity = data.get('quantity')
        
        from inventory.models import AvailableApparatus
        try:
            apparatus = AvailableApparatus.objects.get(apparatus_name=apparatus_name)
            if quantity > apparatus.available_quantity_pieces:
                raise serializers.ValidationError(
                    f"Damaged quantity ({quantity}) cannot exceed available quantity ({apparatus.available_quantity_pieces}) for {apparatus_name}"
                )
        except AvailableApparatus.DoesNotExist:
            raise serializers.ValidationError(f"Apparatus '{apparatus_name}' not found in inventory")
            
        return data

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value


class DamagedEntryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new damaged entry with nested items"""
    damaged_items = DamagedItemWriteSerializer(many=True, required=True)

    class Meta:
        model = DamagedEntry
        fields = ['staff', 'class_name', 'date', 'details', 'damaged_items']

    
    def validate(self, data):
        # At least one damaged item must be provided
        damaged_items = data.get('damaged_items', [])
        
        if not damaged_items:
            raise serializers.ValidationError(
                "At least one damaged apparatus item must be added"
            )
        
        return data
    
    def create(self, validated_data):
        damaged_items_data = validated_data.pop('damaged_items', [])
        
        # Create damaged entry
        damaged_entry = DamagedEntry.objects.create(**validated_data)
        
        # Create damaged items
        for item_data in damaged_items_data:
            DamagedItem.objects.create(damaged_entry=damaged_entry, **item_data)
        
        return damaged_entry
