from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import StockRegisterViewSet
from .report_views import StockRegisterReportView

router = DefaultRouter()
router.register(r'stock_register', StockRegisterViewSet, basename='stockregister')

urlpatterns = [
    path('stock_register/report/', StockRegisterReportView.as_view(), name='stock-register-report'),
] + router.urls
