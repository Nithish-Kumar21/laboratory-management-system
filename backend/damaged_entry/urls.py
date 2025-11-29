from rest_framework.routers import DefaultRouter
from .views import DamagedEntryViewSet

router = DefaultRouter()
router.register(r'damaged_entry', DamagedEntryViewSet, basename='damagedentry')

urlpatterns = router.urls
