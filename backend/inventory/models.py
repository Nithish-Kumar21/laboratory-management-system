from django.db import models

class AvailableChemical(models.Model):
    chemical_name = models.CharField(max_length=64)
    available_quantity_ml = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    last_updated = models.DateField(auto_now=True)
    reorder_level = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True)

    class Meta:
        db_table = 'available_chemicals'
        managed = False

    def __str__(self):
        return self.chemical_name


class AvailableApparatus(models.Model):
    apparatus_name = models.CharField(max_length=64)
    available_quantity_pieces = models.IntegerField(default=0)
    last_updated = models.DateField(auto_now=True)
    reorder_level = models.IntegerField(default=0, null=True)

    class Meta:
        db_table = 'available_apparatus'
        managed = False

    def __str__(self):
        return self.apparatus_name


class LowStockChemical(models.Model):
    chemical_name = models.CharField(max_length=64)
    current_quantity_ml = models.DecimalField(max_digits=10, decimal_places=2)
    reorder_level = models.DecimalField(max_digits=10, decimal_places=2)
    last_checked = models.DateField()

    class Meta:
        db_table = 'low_stock_chemicals'
        managed = False

    def __str__(self):
        return f"{self.chemical_name} (Low Stock)"


class LowStockApparatus(models.Model):
    apparatus_name = models.CharField(max_length=64)
    current_quantity_pieces = models.IntegerField()
    reorder_level = models.IntegerField()
    last_checked = models.DateField()

    class Meta:
        db_table = 'low_stock_apparatus'
        managed = False

    def __str__(self):
        return f"{self.apparatus_name} (Low Stock)"
