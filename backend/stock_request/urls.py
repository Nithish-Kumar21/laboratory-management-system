from rest_framework.routers import DefaultRouter
from .views import StockRequestViewSet, IssueRegisterViewSet

router = DefaultRouter()
router.register(r'stock_request', StockRequestViewSet, basename='stockrequest')
router.register(r'issue_register', IssueRegisterViewSet, basename='issueregister')
urlpatterns = router.urls
