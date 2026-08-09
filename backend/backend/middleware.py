from django.conf import settings
from django.http import JsonResponse


class MaxRequestBodySizeMiddleware:
    """Reject bodies larger than DATA_UPLOAD_MAX_MEMORY_SIZE with HTTP 413.

    DRF reads JSON via the raw WSGI stream (request.read()), which bypasses
    Django's DATA_UPLOAD_MAX_MEMORY_SIZE check (that only runs on request.body),
    so the limit must be enforced here at the request boundary.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        limit = getattr(settings, 'DATA_UPLOAD_MAX_MEMORY_SIZE', None)
        content_length = request.META.get('CONTENT_LENGTH')
        if limit is not None and content_length:
            try:
                length = int(content_length)
            except (TypeError, ValueError):
                length = 0
            if length > limit:
                return JsonResponse(
                    {'detail': 'Request body too large. Maximum size is 2 MB.'},
                    status=413,
                )
        return self.get_response(request)
