from rest_framework import serializers
from .models import (
    AvailableChemical, AvailableApparatus,
    LowStockChemical, LowStockApparatus,
    LabConfiguration
)

class AvailableChemicalSerializer(serializers.ModelSerializer):
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    remaining = serializers.SerializerMethodField()
    unit = serializers.SerializerMethodField()

    class Meta:
        model = AvailableChemical
        fields = ['id', 'chemical_name', 'quantity', 'remaining', 'unit', 'reorder_level', 'last_updated']

    def get_remaining(self, obj):
        return obj.quantity - (obj.committed_quantity_ml or 0)

    def get_unit(self, obj):
        return obj.unit

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        role = getattr(getattr(request, 'user', None), 'role', None)
        if role == 'staff':
            data['quantity'] = data['remaining']
        return data

class AvailableApparatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailableApparatus
        fields = ['id', 'apparatus_name', 'available_quantity_pieces', 'reorder_level', 'last_updated']



class LowStockChemicalSerializer(serializers.ModelSerializer):
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    unit = serializers.SerializerMethodField()

    class Meta:
        model = LowStockChemical
        fields = ['id', 'chemical_name', 'quantity', 'unit', 'reorder_level', 'last_checked']

    def get_unit(self, obj):
        return obj.unit


class LowStockApparatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = LowStockApparatus
        fields = ['id', 'apparatus_name', 'current_quantity_pieces', 'reorder_level', 'last_checked']


class LabConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabConfiguration
        fields = '__all__'
