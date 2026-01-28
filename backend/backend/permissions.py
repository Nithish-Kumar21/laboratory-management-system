from rest_framework import permissions

class InventoryPermission(permissions.BasePermission):
    """
    inventory module:
    hod, store keeper, staff: view only
    admin: view only (it's a read-only view anyway)
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # All 4 roles can view
        if request.method in permissions.SAFE_METHODS:
            return True
            
        return request.user.role in ['admin', 'store_keeper']

class StockRegisterPermission(permissions.BasePermission):
    """
    stock register module:
    hod: view only
    store keeper: add new stocks, view, AND delete
    staff: no access
    admin: view and add only (delete restricted to store keeper)
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
            
        role = request.user.role
        
        if role == 'staff':
            return False
            
        if role == 'hod':
            return request.method in permissions.SAFE_METHODS
            
        if role == 'store_keeper':
            return True
            
        if role == 'admin':
            return request.method != 'DELETE'
            
        return False

class DamagedEntryPermission(permissions.BasePermission):
    """
    damaged entry module:
    hod: view only
    store keeper: add record, view, AND delete
    staff: no access
    admin: view and add only (delete restricted to store keeper)
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
            
        role = request.user.role
        
        if role == 'staff':
            return False
            
        if role == 'hod':
            return request.method in permissions.SAFE_METHODS
            
        if role == 'store_keeper':
            return True
            
        if role == 'admin':
            return request.method != 'DELETE'
            
        return False
