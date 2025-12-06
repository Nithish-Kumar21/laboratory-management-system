from django.contrib import admin
from .models import StockRegister, ChemicalItem, ApparatusItem

class ChemicalItemInline(admin.TabularInline):
    model = ChemicalItem
    extra = 0
    fields = ('chemical_name', 'make', 'quantity_ml', 'rate')  # Added make

class ApparatusItemInline(admin.TabularInline):
    model = ApparatusItem
    extra = 0
    fields = ('apparatus_name', 'make', 'quantity_pieces', 'rate')  # Added make

@admin.register(StockRegister)
class StockRegisterAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'date', 'supplier_name')  # Added supplier_name
    search_fields = ('invoice_number', 'supplier_name')  # Added supplier_name
    list_filter = ('date', 'supplier_name')  # Added supplier_name for filtering
    inlines = [ChemicalItemInline, ApparatusItemInline]
