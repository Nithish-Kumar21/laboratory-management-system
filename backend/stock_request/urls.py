from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import StockRequestViewSet, IssueRegisterViewSet
from .report_views import IssueRegisterReportView

router = DefaultRouter()
router.register(r'stock_request', StockRequestViewSet, basename='stockrequest')
router.register(r'issue_register', IssueRegisterViewSet, basename='issueregister')

urlpatterns = [
    path('issue_register/report/', IssueRegisterReportView.as_view(), name='issue-register-report'),
] + router.urls
