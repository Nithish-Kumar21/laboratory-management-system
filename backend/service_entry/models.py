from django.db import models


class ServiceEntry(models.Model):
    service_code = models.CharField(max_length=20, unique=True)
    storekeeper = models.CharField(max_length=64)
    service_person_name = models.CharField(max_length=64)
    contact_country_code = models.CharField(max_length=5)
    contact_number = models.CharField(max_length=10)
    email = models.EmailField(max_length=100, blank=True, null=True)
    deliver_by_date = models.DateField(blank=True, null=True)
    date = models.DateField()
    status = models.CharField(max_length=20)
    completed_at = models.DateTimeField(blank=True, null=True)
    company_name = models.CharField(max_length=128, null=True, blank=True)
    company_address = models.TextField(null=True, blank=True)
    company_contact_country_code = models.CharField(max_length=5, null=True, blank=True)
    company_contact_number = models.CharField(max_length=10, null=True, blank=True)

    class Meta:
        app_label = 'service_entry'
        db_table = 'service_entry'
        managed = False

    def __str__(self):
        return f"{self.service_code} - {self.storekeeper}"


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
