from django.db import models
from django.conf import settings
from django.utils import timezone


class StockRequest(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]
    
    CLASS_CHOICES = [
        ('I B.Sc Chemistry', 'I B.Sc Chemistry'),
        ('II B.Sc Chemistry', 'II B.Sc Chemistry'),
        ('III B.Sc Chemistry', 'III B.Sc Chemistry'),
        ('I M.Sc Chemistry', 'I M.Sc Chemistry'),
        ('II M.Sc Chemistry', 'II M.Sc Chemistry'),
    ]

    request_id = models.CharField(max_length=20, unique=True, editable=False)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='stock_requests'
    )
    class_name = models.CharField(max_length=50, choices=CLASS_CHOICES)
    date = models.DateField(auto_now_add=True)
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
    viewed_by_requester = models.BooleanField(default=False)

    class Meta:
        db_table = 'stock_request'
        managed = True
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.request_id:
            from django.utils import timezone
            current_year = timezone.now().year
            
            # Get the count of requests created this year
            year_requests = StockRequest.objects.filter(
                created_at__year=current_year
            ).count()
            
            # Generate sequential number (starting from 1)
            sequence_number = year_requests + 1
            
            # Format: REQ-YYYY-XXX (e.g., REQ-2026-001, REQ-2026-123)
            self.request_id = f"REQ-{current_year}-{sequence_number:03d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.request_id} by {self.requested_by.full_name} - {self.status}"


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
