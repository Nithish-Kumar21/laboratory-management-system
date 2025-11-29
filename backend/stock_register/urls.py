from rest_framework.routers import DefaultRouter
from .views import StockRegisterViewSet

router = DefaultRouter()
router.register(r'stock_register', StockRegisterViewSet, basename='stockregister')

urlpatterns = router.urls
