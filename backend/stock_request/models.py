from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import date


class StockRequest(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('issued', 'Issued'),
        ('reported', 'Reported'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
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
    date = models.DateField(default=date.today)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reason = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_requests'
    )
    issued_at = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='issued_requests'
    )
    reported_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    viewed_by_requester = models.BooleanField(default=False)

    class Meta:
        db_table = 'stock_request'
        managed = False
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.request_id:
            from django.utils import timezone
            current_year = timezone.now().year
            
            # Get the last request created this year to determine the next sequence number
            last_request = StockRequest.objects.filter(
                created_at__year=current_year
            ).order_by('-request_id').first()
            
            if last_request and last_request.request_id:
                try:
                    # Extract sequence number from REQ-YYYY-XXX
                    last_sequence = int(last_request.request_id.split('-')[-1])
                    sequence_number = last_sequence + 1
                except (ValueError, IndexError):
                    # Fallback if ID format is unexpected
                    sequence_number = StockRequest.objects.filter(
                        created_at__year=current_year
                    ).count() + 1
            else:
                sequence_number = 1
            
            # Format: REQ-YYYY-XXX (e.g., REQ-2026-001, REQ-2026-123)
            self.request_id = f"REQ-{current_year}-{sequence_number:03d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.request_id} by {self.requested_by.full_name} - {self.status}"


class StockRequestChemicalItem(models.Model):
    UNIT_CHOICES = [
        ('ml', 'mL'),
        ('g', 'g'),
    ]

    stock_request = models.ForeignKey(
        StockRequest,
        on_delete=models.CASCADE,
        related_name='chemical_items'
    )
    chemical_name = models.CharField(max_length=64)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=2, choices=UNIT_CHOICES, default='ml')
    actual_used_quantity = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = 'stock_request_chemical_item'
        managed = False

    def __str__(self):
        return f"{self.chemical_name} - {self.quantity} {self.unit}"


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
        managed = False

    def __str__(self):
        return f"{self.apparatus_name} - {self.quantity_pieces} pcs"


class IssueRegister(models.Model):
    ir_id = models.AutoField(primary_key=True)
    request_code = models.CharField(max_length=20, null=True, blank=True)
    stock_request_db_id = models.IntegerField(null=True, blank=True)
    staff_name = models.CharField(max_length=100)
    class_field = models.CharField(db_column='class', max_length=50)
    date = models.DateField()
    status = models.CharField(max_length=20)

    class Meta:
        managed = False
        db_table = 'issue_register'

    def __str__(self):
        return f"{self.ir_id} - {self.staff_name}"


class IssueChemicals(models.Model):
    UNIT_CHOICES = [
        ('ml', 'mL'),
        ('g', 'g'),
    ]

    ir = models.ForeignKey(IssueRegister, on_delete=models.CASCADE, related_name='chemicals')
    chemical_name = models.CharField(max_length=64)
    issued_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=2, choices=UNIT_CHOICES, default='ml')
    actual_usage = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)

    @property
    def returned(self):
        if self.actual_usage is not None and self.issued_quantity >= self.actual_usage:
            return self.issued_quantity - self.actual_usage
        return 0

    @property
    def additional(self):
        if self.actual_usage is not None and self.actual_usage > self.issued_quantity:
            return self.actual_usage - self.issued_quantity
        return 0

    class Meta:
        managed = False
        db_table = 'issue_chemicals'

    def __str__(self):
        return f"{self.chemical_name}"
