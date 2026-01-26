from django.urls import path
from . import views

urlpatterns = [
    # Authentication endpoints
    path('auth/login/', views.login_view, name='login'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/me/', views.current_user_view, name='current-user'),
    path('auth/check-session/', views.check_session_view, name='check-session'),
    
    # User management endpoints (superuser only)
    path('users/', views.list_users_view, name='list-users'),
    path('users/create/', views.create_user_view, name='create-user'),
    path('users/<int:user_id>/', views.get_user_view, name='get-user'),
    path('users/<int:user_id>/update/', views.update_user_view, name='update-user'),
    path('users/<int:user_id>/delete/', views.deactivate_user_view, name='deactivate-user'),
    path('users/<int:user_id>/activate/', views.activate_user_view, name='activate-user'),
    path('users/<int:user_id>/reset-password/', views.admin_reset_password_view, name='admin-reset-password'),
    
    # Password management endpoints
    path('password/change/', views.change_password_view, name='change-password'),
    path('password/reset-request/', views.password_reset_request_view, name='password-reset-request'),
    path('password/reset-confirm/', views.password_reset_confirm_view, name='password-reset-confirm'),
    path('password/validate-token/<str:token>/', views.validate_reset_token_view, name='validate-reset-token'),
    
    # Profile endpoints
    path('profile/', views.get_profile_view, name='get-profile'),
    path('profile/update/', views.update_profile_view, name='update-profile'),
    
    # Utility endpoints
    path('users/check-employee-id/<str:employee_id>/', views.check_employee_id_view, name='check-employee-id'),
    path('users/check-email/<str:email>/', views.check_email_view, name='check-email'),
    path('users/stats/', views.user_stats_view, name='user-stats'),
]
