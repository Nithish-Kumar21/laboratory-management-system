from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, PasswordResetToken


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('employee_id', 'full_name', 'email', 'role', 'department', 'is_active', 'date_joined')
    list_filter = ('role', 'department', 'is_active', 'is_staff', 'is_superuser')
    search_fields = ('employee_id', 'full_name', 'email', 'phone')
    ordering = ('-date_joined',)
    
    fieldsets = (
        ('Authentication', {
            'fields': ('employee_id', 'password')
        }),
        ('Personal Information', {
            'fields': ('full_name', 'email', 'phone')
        }),
        ('Work Information', {
            'fields': ('role', 'designation', 'department')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        ('Security', {
            'fields': ('password_must_change', 'last_password_change', 'failed_login_attempts', 'account_locked_until')
        }),
        ('Metadata', {
            'fields': ('date_joined', 'last_login', 'created_by')
        }),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('employee_id', 'full_name', 'email', 'phone', 'role', 'designation', 'department', 'password1', 'password2'),
        }),
    )
    
    readonly_fields = ('date_joined', 'last_login', 'created_by', 'last_password_change')


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'token', 'created_at', 'expires_at', 'used')
    list_filter = ('used', 'created_at')
    search_fields = ('user__employee_id', 'token')
    readonly_fields = ('token', 'created_at', 'expires_at')
    ordering = ('-created_at',)
