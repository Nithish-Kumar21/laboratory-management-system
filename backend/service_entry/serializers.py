from rest_framework import serializers
from .models import ServiceEntry, ServiceEntryItem, ServiceEntryItemLog
from inventory.models import AvailableApparatus


class ServiceEntryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceEntryItem
        fields = ['id', 'apparatus_name', 'quantity_sent', 'quantity_remaining', 'quantity_repaired', 'quantity_damaged']


class ServiceEntryItemLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceEntryItemLog
        fields = ['id', 'service_entry_item', 'action_type', 'quantity', 'actioned_by', 'actioned_at']
        read_only_fields = ['actioned_at']


class ServiceEntryListSerializer(serializers.ModelSerializer):
    items = ServiceEntryItemSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceEntry
        fields = ['id', 'service_code', 'storekeeper', 'service_person_name', 'date', 'status', 'completed_at', 'items']


class ServiceEntryDetailSerializer(serializers.ModelSerializer):
    items = ServiceEntryItemSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceEntry
        fields = [
            'id', 'service_code', 'storekeeper', 'service_person_name',
            'contact_country_code', 'contact_number', 'email',
            'deliver_by_date', 'date', 'status', 'completed_at', 'items',
        ]


class ServiceEntryItemWriteSerializer(serializers.Serializer):
    apparatus_name = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)

    def to_representation(self, instance):
        return {
            'apparatus_name': instance.apparatus_name,
            'quantity': instance.quantity_sent,
        }

    def validate(self, data):
        apparatus_name = data.get('apparatus_name')
        quantity = data.get('quantity')

        try:
            apparatus = AvailableApparatus.objects.get(apparatus_name__iexact=apparatus_name)
        except AvailableApparatus.DoesNotExist:
            raise serializers.ValidationError(
                f"Apparatus '{apparatus_name}' not found in inventory"
            )

        if quantity > apparatus.available_quantity_pieces:
            raise serializers.ValidationError(
                f"Requested quantity ({quantity}) exceeds available stock ({apparatus.available_quantity_pieces}) for {apparatus_name}"
            )

        return data


class ServiceEntryCreateSerializer(serializers.ModelSerializer):
    items = ServiceEntryItemWriteSerializer(many=True, required=True)

    class Meta:
        model = ServiceEntry
        fields = [
            'service_person_name', 'contact_country_code', 'contact_number',
            'email', 'deliver_by_date', 'items',
        ]

    def validate_contact_number(self, value):
        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError("Contact number must be exactly 10 digits")
        return value

    def validate(self, data):
        items = data.get('items', [])
        if not items:
            raise serializers.ValidationError("At least one apparatus item must be added")
        return data

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        request = self.context.get('request')
        user = request.user if request else None
        username = user.full_name if user and hasattr(user, 'full_name') else str(user)

        from django.utils import timezone
        today = timezone.now().date()

        last_entry = ServiceEntry.objects.all().order_by('-id').first()
        if last_entry and last_entry.service_code:
            try:
                last_num = int(last_entry.service_code.split('-')[-1])
                sequence = last_num + 1
            except (ValueError, IndexError):
                sequence = 1
        else:
            sequence = 1

        service_code = f"SVC-{sequence:03d}"

        entry = ServiceEntry.objects.create(
            service_code=service_code,
            storekeeper=username,
            date=today,
            status='in_service',
            **validated_data,
        )

        for item_data in items_data:
            ServiceEntryItem.objects.create(
                service_entry=entry,
                apparatus_name=item_data['apparatus_name'],
                quantity_sent=item_data['quantity'],
                quantity_remaining=item_data['quantity'],
                quantity_repaired=0,
                quantity_damaged=0,
            )

        return entry


class ServiceActionSerializer(serializers.Serializer):
    action_type = serializers.ChoiceField(choices=['repaired', 'damaged'])
    quantity = serializers.IntegerField(min_value=1)
