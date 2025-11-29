from django.contrib import admin
from .models import DamagedEntry, DamagedItem


class DamagedItemInline(admin.TabularInline):
    model = DamagedItem
    extra = 0


@admin.register(DamagedEntry)
class DamagedEntryAdmin(admin.ModelAdmin):
    list_display = ('staff', 'class_name', 'date', 'caused_by')
    search_fields = ('staff', 'caused_by')
    list_filter = ('date',)
    inlines = [DamagedItemInline]
