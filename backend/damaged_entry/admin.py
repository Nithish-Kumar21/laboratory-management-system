from django.contrib import admin
from .models import DamagedEntry, DamagedItem


class DamagedItemInline(admin.TabularInline):
    model = DamagedItem
    extra = 0
    fields = ('apparatus_name', 'quantity', 'caused_by')


@admin.register(DamagedEntry)
class DamagedEntryAdmin(admin.ModelAdmin):
    list_display = ('staff', 'class_name', 'date')
    search_fields = ('staff',)
    list_filter = ('date',)
    inlines = [DamagedItemInline]
