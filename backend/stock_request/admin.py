from django.contrib import admin
from .models import StockRequest, StockRequestChemicalItem, StockRequestApparatusItem


class StockRequestChemicalItemInline(admin.TabularInline):
    model = StockRequestChemicalItem
    extra = 0


class StockRequestApparatusItemInline(admin.TabularInline):
    model = StockRequestApparatusItem
    extra = 0


@admin.register(StockRequest)
class StockRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'requested_by', 'status', 'created_at']
    list_filter = ['status']
    inlines = [StockRequestChemicalItemInline, StockRequestApparatusItemInline]
