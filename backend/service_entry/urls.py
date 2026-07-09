from rest_framework.routers import DefaultRouter
from .views import ServiceEntryViewSet

router = DefaultRouter()
router.register(r'service-entries', ServiceEntryViewSet, basename='serviceentry')

urlpatterns = router.urls
