from django.db import models
from users.models import User


class ServiceEntry(models.Model):
    service_code = models.CharField(max_length=20, unique=True)
    storekeeper = models.CharField(max_length=64)
    service_person_name = models.CharField(max_length=64)
    contact_country_code = models.CharField(max_length=5)
    contact_number = models.CharField(max_length=10)
    email = models.EmailField(max_length=100, blank=True, null=True)
    deliver_by_date = models.DateField(blank=True, null=True)
    company_name = models.CharField(max_length=128, blank=True, null=True)
    company_address = models.TextField(blank=True, null=True)
    company_contact_country_code = models.CharField(max_length=5, blank=True, null=True)
    company_contact_number = models.CharField(max_length=10, blank=True, null=True)
    vendor_name = models.CharField(max_length=128, blank=True, null=True)
    vendor_contact = models.CharField(max_length=128, blank=True, null=True)
    entry_date = models.DateField(blank=True, null=True)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    remarks = models.TextField(blank=True, null=True)
    date = models.DateField()
    status = models.CharField(max_length=20)
    completed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        db_column='created_by_id', related_name='service_entries_created'
    )
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        db_column='updated_by_id', related_name='service_entries_updated'
    )

    class Meta:
        app_label = 'service_entry'
        db_table = 'service_entry'
        managed = False

    def __str__(self):
        return f"{self.service_code} - {self.storekeeper}"

    @property
    def items_log(self):
        logs = ServiceEntryItemLog.objects.filter(
            service_entry_item__service_entry=self
        ).select_related('service_entry_item').order_by('-actioned_at')
        return logs


class ServiceEntryItem(models.Model):
    service_entry = models.ForeignKey(
        ServiceEntry,
        on_delete=models.DO_NOTHING,
        related_name='items',
        db_column='service_entry_id'
    )
    apparatus_name = models.CharField(max_length=64)
    quantity_sent = models.IntegerField()
    quantity_remaining = models.IntegerField()
    quantity_repaired = models.IntegerField()
    quantity_damaged = models.IntegerField()

    class Meta:
        app_label = 'service_entry'
        db_table = 'service_entry_items'
        managed = False

    def __str__(self):
        return f"{self.apparatus_name} ({self.service_entry.service_code})"


class ServiceEntryItemLog(models.Model):
    service_entry_item = models.ForeignKey(
        ServiceEntryItem,
        on_delete=models.DO_NOTHING,
        related_name='logs',
        db_column='service_entry_item_id'
    )
    action_type = models.CharField(max_length=10)
    quantity = models.IntegerField()
    actioned_by = models.CharField(max_length=64)
    actioned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'service_entry'
        db_table = 'service_entry_item_logs'
        managed = False

    def __str__(self):
        return f"{self.action_type} x{self.quantity} on item {self.service_entry_item_id}"
