from rest_framework.routers import DefaultRouter
from .views import (
    AvailableChemicalViewSet, AvailableApparatusViewSet,
    LowStockChemicalViewSet, LowStockApparatusViewSet
)

router = DefaultRouter()
router.register(r'available_chemicals', AvailableChemicalViewSet, basename='availablechemical')
router.register(r'available_apparatus', AvailableApparatusViewSet, basename='availableapparatus')
router.register(r'low_stock_chemicals', LowStockChemicalViewSet, basename='lowstockchemical')
router.register(r'low_stock_apparatus', LowStockApparatusViewSet, basename='lowstockapparatus')

urlpatterns = router.urls





