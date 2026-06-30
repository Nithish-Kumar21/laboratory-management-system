from django.db import models

UNIT_CHOICES = [
    ('ml', 'mL'),
    ('g', 'g'),
]

class StockRegister(models.Model):
    invoice_number = models.CharField(max_length=50, unique=True)
    date = models.DateField()
    supplier_name = models.CharField(max_length=100)
    remarks = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'stock_register'
        managed = False

    def __str__(self):
        return f"{self.invoice_number} - {self.supplier_name}"


class ChemicalItem(models.Model):
    stock_register = models.ForeignKey(
        StockRegister,
        on_delete=models.DO_NOTHING,
        related_name='chemical_items',
        db_column='stock_register_id'
    )
    chemical_name = models.CharField(max_length=64)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=10, decimal_places=2)
    make = models.CharField(max_length=100)
    unit = models.CharField(max_length=2, choices=UNIT_CHOICES, default='ml')

    class Meta:
        db_table = 'chemical_item'
        managed = False

    def __str__(self):
        return f"{self.chemical_name} ({self.make}) - {self.stock_register.invoice_number}"


class ApparatusItem(models.Model):
    stock_register = models.ForeignKey(
        StockRegister,
        on_delete=models.DO_NOTHING,
        related_name='apparatus_items',
        db_column='stock_register_id'
    )
    apparatus_name = models.CharField(max_length=64)
    quantity_pieces = models.IntegerField()
    rate = models.DecimalField(max_digits=10, decimal_places=2)
    make = models.CharField(max_length=100)

    class Meta:
        db_table = 'apparatus_item'
        managed = False

    def __str__(self):
        return f"{self.apparatus_name} ({self.make}) - {self.stock_register.invoice_number}"
