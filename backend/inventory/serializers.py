from rest_framework import serializers
from .models import (
    AvailableChemical, AvailableApparatus,
    LowStockChemical, LowStockApparatus,
    LabConfiguration
)

class AvailableChemicalSerializer(serializers.ModelSerializer):
    quantity = serializers.DecimalField(source='available_quantity_ml', max_digits=10, decimal_places=2)
    unit = serializers.SerializerMethodField()

    class Meta:
        model = AvailableChemical
        fields = ['id', 'chemical_name', 'quantity', 'unit', 'reorder_level', 'last_updated']

    def get_unit(self, obj):
        return 'ml'

class AvailableApparatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailableApparatus
        fields = ['id', 'apparatus_name', 'available_quantity_pieces', 'reorder_level', 'last_updated']



class LowStockChemicalSerializer(serializers.ModelSerializer):
    quantity = serializers.DecimalField(source='current_quantity_ml', max_digits=10, decimal_places=2)
    unit = serializers.SerializerMethodField()

    class Meta:
        model = LowStockChemical
        fields = ['id', 'chemical_name', 'quantity', 'unit', 'reorder_level', 'last_checked']

    def get_unit(self, obj):
        return 'ml'


class LowStockApparatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = LowStockApparatus
        fields = ['id', 'apparatus_name', 'current_quantity_pieces', 'reorder_level', 'last_checked']


class LabConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabConfiguration
        fields = '__all__'
