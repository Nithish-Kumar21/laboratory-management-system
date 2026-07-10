from django.conf import settings
from django.http import JsonResponse
from django.urls import resolve
from rest_framework_simplejwt.authentication import JWTAuthentication


class FirstLoginMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith('/api/'):
            return self.get_response(request)

        # Skip the change-password and login endpoints
        exempt_paths = [
            '/api/auth/login/',
            '/api/auth/change-password/',
            '/api/auth/token/refresh/',
            '/api/auth/logout/',
            '/api/users/login/',
            '/api/users/change-password/',
            '/api/users/reset-password/',
            '/api/users/forgot-password/',
        ]
        if any(request.path.startswith(p) for p in exempt_paths):
            return self.get_response(request)

        # Try to authenticate the user
        try:
            auth = JWTAuthentication()
            user, _ = auth.authenticate(request)
            if user and getattr(user, 'is_first_login', False):
                return JsonResponse(
                    {'success': False, 'error': 'You must change your password before accessing this resource.', 'code': 'FIRST_LOGIN_REQUIRED'},
                    status=403,
                )
        except Exception:
            pass

        return self.get_response(request)
