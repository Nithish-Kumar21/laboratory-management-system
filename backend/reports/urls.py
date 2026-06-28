from django.urls import path
from . import views

urlpatterns = [
    path('reports/year-end/', views.YearEndReportView.as_view(), name='year-end-report'),
    path('reports/year-end/download/pdf/', views.YearEndPDFDownloadView.as_view(), name='year-end-report-pdf'),
    path('reports/year-end/download/excel/', views.YearEndExcelDownloadView.as_view(), name='year-end-report-excel'),
]
