from rest_framework.routers import DefaultRouter
from .views import StockRequestViewSet

router = DefaultRouter()
router.register(r'stock_request', StockRequestViewSet, basename='stockrequest')
urlpatterns = router.urls
