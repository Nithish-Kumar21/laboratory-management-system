from django.contrib import admin
from .models import StockRegister, ChemicalItem, ApparatusItem


class ChemicalItemInline(admin.TabularInline):
    model = ChemicalItem
    extra = 0


class ApparatusItemInline(admin.TabularInline):
    model = ApparatusItem
    extra = 0


@admin.register(StockRegister)
class StockRegisterAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'date')
    search_fields = ('invoice_number',)
    inlines = [ChemicalItemInline, ApparatusItemInline]
