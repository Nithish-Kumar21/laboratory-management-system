from rest_framework import serializers
from .models import (
    AvailableChemical, AvailableApparatus,
    LowStockChemical, LowStockApparatus,
    LabConfiguration
)

class AvailableChemicalSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailableChemical
        fields = ['id', 'chemical_name', 'available_quantity_ml', 'reorder_level', 'last_updated']

class AvailableApparatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailableApparatus
        fields = ['id', 'apparatus_name', 'available_quantity_pieces', 'reorder_level', 'last_updated']



class LowStockChemicalSerializer(serializers.ModelSerializer):
    class Meta:
        model = LowStockChemical
        fields = ['id', 'chemical_name', 'current_quantity_ml', 'reorder_level', 'last_checked']


class LowStockApparatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = LowStockApparatus
        fields = ['id', 'apparatus_name', 'current_quantity_pieces', 'reorder_level', 'last_checked']


class LabConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabConfiguration
        fields = '__all__'
