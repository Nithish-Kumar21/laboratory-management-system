from django.urls import path
from . import views

urlpatterns = [
    path('classes/', views.ClassesListView.as_view(), name='classes-list'),
    path('classes/all/', views.AllClassesListView.as_view(), name='classes-all'),
]
