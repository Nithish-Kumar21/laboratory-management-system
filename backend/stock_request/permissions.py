from rest_framework import permissions


class StockRequestPermission(permissions.BasePermission):
    """
    Stock request module:
    - staff: create requests, list own requests
    - hod: list all requests, accept/reject pending
    - admin: view only (optional)
    - store_keeper: no access
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        role = request.user.role

        if role == 'store_keeper':
            return False

        # Staff: create, list own, delete own
        if role == 'staff':
            return request.method in ['GET', 'POST', 'DELETE']

        # HOD: list, retrieve, accept, reject (custom actions), cannot delete
        if role == 'hod':
            return request.method != 'DELETE'

        # Admin: read only
        if role == 'admin':
            return request.method in permissions.SAFE_METHODS

        return False
