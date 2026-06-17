from django.db import models

class AvailableChemical(models.Model):
    UNIT_CHOICES = [('ml', 'mL'), ('g', 'g')]
    chemical_name = models.CharField(max_length=64)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit = models.CharField(max_length=2, choices=UNIT_CHOICES, default='ml')
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
    UNIT_CHOICES = [('ml', 'mL'), ('g', 'g')]
    chemical_name = models.CharField(max_length=64)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=2, choices=UNIT_CHOICES, default='ml')
    reorder_level = models.DecimalField(max_digits=10, decimal_places=2)
    last_checked = models.DateField()

    class Meta:
        db_table = 'low_stock_chemicals'
        managed = False

    def __str__(self):
        return f"{self.chemical_name} (Low Stock)"

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


class LabConfiguration(models.Model):
    use_common_reorder_level = models.BooleanField(default=False)
    common_chemical_reorder_level = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    common_apparatus_reorder_level = models.IntegerField(default=0)

    class Meta:
        db_table = 'lab_configuration'
        managed = False

    def __str__(self):
        return "Lab Configuration"
