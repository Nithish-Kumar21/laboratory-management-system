from django.db import models

class DamagedEntry(models.Model):
    staff = models.CharField(max_length=100)
    class_name = models.CharField(max_length=50, db_column='class')
    date = models.DateField()
    details = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'damaged_entry'
        managed = True

    def __str__(self):
        return f"{self.staff} - {self.date}"


class DamagedItem(models.Model):
    damaged_entry = models.ForeignKey(
        DamagedEntry,
        on_delete=models.DO_NOTHING,
        related_name='damaged_items',
        db_column='damaged_entry_id'
    )
    apparatus_name = models.CharField(max_length=64)
    quantity = models.IntegerField()
    caused_by = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = 'damaged_item'
        managed = True

    def __str__(self):
        return f"{self.apparatus_name} - {self.damaged_entry.staff}"
