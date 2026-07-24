from rest_framework import serializers
from django.utils import timezone
from .models import StockRegister, ChemicalItem, ApparatusItem
from inventory.models import AvailableChemical, AvailableApparatus, LabConfiguration
import re


COUNTRY_CODES = [
    ('+91', 'India (+91)'),
    ('+1', 'USA/Canada (+1)'),
    ('+44', 'UK (+44)'),
    ('+61', 'Australia (+61)'),
    ('+65', 'Singapore (+65)'),
    ('+971', 'UAE (+971)'),
    ('+49', 'Germany (+49)'),
    ('+33', 'France (+33)'),
    ('+81', 'Japan (+81)'),
    ('+86', 'China (+86)'),
]


def validate_phone(value):
    if value:
        if not re.match(r'^\d{10}$', value):
            raise serializers.ValidationError("Phone number must be exactly 10 digits")
    return value


# Read-only serializers
class ChemicalItemSerializer(serializers.ModelSerializer):
    pack_size = serializers.DecimalField(max_digits=10, decimal_places=2)
    unit = serializers.SerializerMethodField()
    total_quantity = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ChemicalItem
        fields = ['id', 'chemical_name', 'make', 'pack_size', 'no_of_packs', 'unit', 'rate', 'total_quantity', 'total_price']

    def get_unit(self, obj):
        return obj.unit



class ApparatusItemSerializer(serializers.ModelSerializer):
    total_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ApparatusItem
        fields = ['id', 'apparatus_name', 'make', 'quantity_pieces', 'rate', 'total_price']



class StockRegisterListSerializer(serializers.ModelSerializer):
    chemical_items_count = serializers.SerializerMethodField()
    apparatus_items_count = serializers.SerializerMethodField()

    class Meta:
        model = StockRegister
        fields = ['id', 'invoice_number', 'date', 'supplier_name', 'supplier_contact_country_code',
                  'supplier_contact_phone', 'supplier_email', 'remarks',
                  'chemical_items_count', 'apparatus_items_count']

    def get_chemical_items_count(self, obj):
        return obj.chemical_items.count()

    def get_apparatus_items_count(self, obj):
        return obj.apparatus_items.count()



class StockRegisterDetailSerializer(serializers.ModelSerializer):
    chemical_items = ChemicalItemSerializer(many=True, read_only=True)
    apparatus_items = ApparatusItemSerializer(many=True, read_only=True)

    class Meta:
        model = StockRegister
        fields = ['id', 'invoice_number', 'date', 'supplier_name', 'supplier_contact_country_code',
                  'supplier_contact_phone', 'supplier_email', 'remarks',
                  'chemical_items', 'apparatus_items']



# Write serializers
class ChemicalItemWriteSerializer(serializers.ModelSerializer):
    pack_size = serializers.DecimalField(max_digits=10, decimal_places=2)
    no_of_packs = serializers.IntegerField(default=1)
    unit = serializers.CharField(write_only=True, required=False)
    restock_level = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    total_quantity = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ChemicalItem
        fields = ['chemical_name', 'make', 'pack_size', 'no_of_packs', 'unit', 'rate',
                  'restock_level', 'total_quantity', 'total_price']

    def validate_pack_size(self, value):
        if value <= 0:
            raise serializers.ValidationError("Pack size must be greater than 0")
        return value

    def validate_no_of_packs(self, value):
        if value <= 0:
            raise serializers.ValidationError("Number of packs must be greater than 0")
        return value

    def validate_rate(self, value):
        if value <= 0:
            raise serializers.ValidationError("Rate must be greater than 0")
        return value

    def validate_restock_level(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Restock level cannot be negative")
        return value



class ApparatusItemWriteSerializer(serializers.ModelSerializer):
    restock_level = serializers.IntegerField(required=False, allow_null=True)
    total_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ApparatusItem
        fields = ['apparatus_name', 'make', 'quantity_pieces', 'rate',
                  'restock_level', 'total_price']

    def validate_quantity_pieces(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value

    def validate_rate(self, value):
        if value <= 0:
            raise serializers.ValidationError("Rate must be greater than 0")
        return value



class StockRegisterCreateSerializer(serializers.ModelSerializer):
    chemical_items = ChemicalItemWriteSerializer(many=True, required=False)
    apparatus_items = ApparatusItemWriteSerializer(many=True, required=False)

    class Meta:
        model = StockRegister
        fields = ['id', 'invoice_number', 'date', 'supplier_name',
                  'supplier_contact_country_code', 'supplier_contact_phone', 'supplier_email',
                  'remarks', 'chemical_items', 'apparatus_items']

    def validate_invoice_number(self, value):
        if StockRegister.objects.filter(invoice_number=value).exists():
            raise serializers.ValidationError("Invoice number already exists")
        return value

    def validate_date(self, value):
        if value > timezone.now().date():
            raise serializers.ValidationError("Invoice date cannot be in the future.")
        return value

    def validate_supplier_contact_phone(self, value):
        return validate_phone(value)

    def validate_supplier_email(self, value):
        if value and '@' not in value:
            raise serializers.ValidationError("Enter a valid email address")
        return value

    def create(self, validated_data):
        chemical_items_data = validated_data.pop('chemical_items', [])
        apparatus_items_data = validated_data.pop('apparatus_items', [])

        stock_register = StockRegister.objects.create(**validated_data)

        try:
            config = LabConfiguration.objects.get(id=1)
        except LabConfiguration.DoesNotExist:
            config = None

        for item_data in chemical_items_data:
            restock_level = item_data.pop('restock_level', None)
            if restock_level is None and config and config.use_common_reorder_level:
                restock_level = config.common_chemical_reorder_level
            pack_size = item_data['pack_size']
            no_of_packs = item_data.get('no_of_packs', 1)
            item_data['total_quantity'] = pack_size * no_of_packs
            item_data['total_price'] = no_of_packs * item_data['rate']
            chem_item = ChemicalItem.objects.create(stock_register=stock_register, **item_data)

            chem_name = chem_item.chemical_name
            try:
                available = AvailableChemical.objects.get(chemical_name__iexact=chem_name)
                if restock_level is not None:
                    available.reorder_level = restock_level
                    available.save(update_fields=['reorder_level'])
            except AvailableChemical.DoesNotExist:
                if restock_level is not None:
                    AvailableChemical.objects.create(
                        chemical_name=chem_name,
                        quantity=0,
                        unit=item_data.get('unit', 'ml'),
                        reorder_level=restock_level
                    )

        for item_data in apparatus_items_data:
            restock_level = item_data.pop('restock_level', None)
            if restock_level is None and config and config.use_common_reorder_level:
                restock_level = config.common_apparatus_reorder_level
            qty = item_data['quantity_pieces']
            item_data['total_price'] = qty * item_data['rate']
            app_item = ApparatusItem.objects.create(stock_register=stock_register, **item_data)

            app_name = app_item.apparatus_name
            try:
                available = AvailableApparatus.objects.get(apparatus_name__iexact=app_name)
                if restock_level is not None:
                    available.reorder_level = restock_level
                    available.save(update_fields=['reorder_level'])
            except AvailableApparatus.DoesNotExist:
                if restock_level is not None:
                    AvailableApparatus.objects.create(
                        apparatus_name=app_name,
                        available_quantity_pieces=0,
                        reorder_level=restock_level
                    )

        return stock_register
