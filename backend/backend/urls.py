from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('inventory.urls')),
    path('api/', include('stock_register.urls')),
    path('api/', include('damaged_entry.urls')),
    path('api/', include('stock_request.urls')),
    path('api/users/', include('users.urls')),
    path('api/', include('reports.urls')),
    path('api/', include('service_entry.urls')),
    path('api/', include('users.class_urls')),
    path('api/', include('audit.urls')),

]
