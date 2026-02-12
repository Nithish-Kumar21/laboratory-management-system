from django.db import models
from django.conf import settings


class StockRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='stock_requests'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_requests'
    )

    class Meta:
        db_table = 'stock_request'
        managed = True
        ordering = ['-created_at']

    def __str__(self):
        return f"Request #{self.id} by {self.requested_by.full_name} - {self.status}"


class StockRequestChemicalItem(models.Model):
    stock_request = models.ForeignKey(
        StockRequest,
        on_delete=models.CASCADE,
        related_name='chemical_items'
    )
    chemical_name = models.CharField(max_length=64)
    quantity_ml = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'stock_request_chemical_item'
        managed = True

    def __str__(self):
        return f"{self.chemical_name} - {self.quantity_ml} ml"


class StockRequestApparatusItem(models.Model):
    stock_request = models.ForeignKey(
        StockRequest,
        on_delete=models.CASCADE,
        related_name='apparatus_items'
    )
    apparatus_name = models.CharField(max_length=64)
    quantity_pieces = models.IntegerField()

    class Meta:
        db_table = 'stock_request_apparatus_item'
        managed = True

    def __str__(self):
        return f"{self.apparatus_name} - {self.quantity_pieces} pcs"
