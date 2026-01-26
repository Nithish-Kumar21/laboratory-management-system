from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.db import IntegrityError
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer
)
from .permissions import superuser_required, authenticated_required
from .models import PasswordResetToken
from .utils import send_welcome_email, send_password_reset_email, send_password_changed_notification

User = get_user_model()


# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

@api_view(['POST'])
def login_view(request):
    """
    Login endpoint - authenticate with employee_id and password
    POST /api/auth/login/
    Body: {employee_id, password}
    """
    employee_id = request.data.get('employee_id')
    password = request.data.get('password')
    
    if not employee_id or not password:
        return Response(
            {'error': 'Employee ID and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Authenticate user
    user = authenticate(request, username=employee_id, password=password)
    
    if user is None:
        # Check if account is locked
        try:
            user_obj = User.objects.get(employee_id=employee_id)
            if user_obj.is_account_locked():
                return Response(
                    {
                        'error': 'Account locked',
                        'message': f'Your account has been locked due to multiple failed login attempts. '
                                   f'Please try again after 30 minutes or contact administrator.'
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
        except User.DoesNotExist:
            pass
        
        return Response(
            {'error': 'Invalid employee ID or password'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Check if user is active
    if not user.is_active:
        return Response(
            {'error': 'Account is deactivated. Please contact administrator.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Login user (create session)
    login(request, user)
    
    # Serialize user data
    serializer = UserSerializer(user)
    
    return Response({
        'message': 'Login successful',
        'user': serializer.data,
        'password_must_change': user.password_must_change
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@authenticated_required
def logout_view(request):
    """
    Logout endpoint
    POST /api/auth/logout/
    """
    logout(request)
    return Response(
        {'message': 'Logout successful'},
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
@authenticated_required
def current_user_view(request):
    """
    Get current authenticated user
    GET /api/auth/me/
    """
    serializer = UserSerializer(request.user)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
def check_session_view(request):
    """
    Check if session is valid
    GET /api/auth/check-session/
    """
    if request.user.is_authenticated:
        serializer = UserSerializer(request.user)
        return Response({
            'authenticated': True,
            'user': serializer.data
        }, status=status.HTTP_200_OK)
    
    return Response(
        {'authenticated': False},
        status=status.HTTP_200_OK
    )


# ============================================
# USER MANAGEMENT ENDPOINTS (Superuser only)
# ============================================

@api_view(['GET'])
@superuser_required
def list_users_view(request):
    """
    List all users with optional filtering
    GET /api/users/
    Query params: role, department, is_active, search
    """
    users = User.objects.all()
    
    # Filtering
    role = request.GET.get('role')
    if role:
        users = users.filter(role=role)
    
    department = request.GET.get('department')
    if department:
        users = users.filter(department=department)
    
    is_active = request.GET.get('is_active')
    if is_active is not None:
        users = users.filter(is_active=is_active.lower() == 'true')
    
    search = request.GET.get('search')
    if search:
        users = users.filter(
            employee_id__icontains=search
        ) | users.filter(
            full_name__icontains=search
        ) | users.filter(
            email__icontains=search
        )
    
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@superuser_required
def create_user_view(request):
    """
    Create new user
    POST /api/users/
    Body: {employee_id, full_name, email, phone, role, designation, department, password (optional)}
    """
    serializer = UserCreateSerializer(data=request.data, context={'request': request})
    
    if serializer.is_valid():
        try:
            user = serializer.save()
            
            # Send welcome email
            plain_password = user._plain_password
            email_sent = send_welcome_email(user, plain_password)
            
            response_data = UserSerializer(user).data
            response_data['generated_password'] = plain_password
            response_data['email_sent'] = email_sent
            
            return Response(
                {
                    'message': 'User created successfully',
                    'user': response_data
                },
                status=status.HTTP_201_CREATED
            )
        except IntegrityError as e:
            return Response(
                {'error': 'Database integrity error. User may already exist.'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@superuser_required
def get_user_view(request, user_id):
    """
    Get user details by ID
    GET /api/users/<id>/
    """
    try:
        user = User.objects.get(id=user_id)
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['PUT', 'PATCH'])
@superuser_required
def update_user_view(request, user_id):
    """
    Update user details
    PUT/PATCH /api/users/<id>/
    Body: {full_name, email, phone, role, designation, department, is_active}
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    serializer = UserUpdateSerializer(user, data=request.data, partial=True)
    
    if serializer.is_valid():
        serializer.save()
        return Response(
            {
                'message': 'User updated successfully',
                'user': UserSerializer(user).data
            },
            status=status.HTTP_200_OK
        )
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@superuser_required
def deactivate_user_view(request, user_id):
    """
    Deactivate user (soft delete)
    DELETE /api/users/<id>/
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if user.id == request.user.id:
        return Response(
            {'error': 'Cannot deactivate your own account'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user.is_active = False
    user.save()
    
    return Response(
        {'message': 'User deactivated successfully'},
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@superuser_required
def activate_user_view(request, user_id):
    """
    Activate user
    POST /api/users/<id>/activate/
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    user.is_active = True
    user.save()
    
    return Response(
        {'message': 'User activated successfully'},
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@superuser_required
def admin_reset_password_view(request, user_id):
    """
    Admin resets user password (generates new password)
    POST /api/users/<id>/reset-password/
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Generate new password
    new_password = User.generate_secure_password()
    user.set_password(new_password)
    user.password_must_change = True
    user.save()
    
    # Send email
    email_sent = send_welcome_email(user, new_password)
    
    return Response(
        {
            'message': 'Password reset successfully',
            'new_password': new_password,
            'email_sent': email_sent
        },
        status=status.HTTP_200_OK
    )


# ============================================
# PASSWORD MANAGEMENT ENDPOINTS
# ============================================

@api_view(['POST'])
@authenticated_required
def change_password_view(request):
    """
    Change own password
    POST /api/password/change/
    Body: {old_password, new_password, confirm_password}
    """
    serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
    
    if serializer.is_valid():
        serializer.save()
        
        # Send notification email
        send_password_changed_notification(request.user)
        
        return Response(
            {'message': 'Password changed successfully'},
            status=status.HTTP_200_OK
        )
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def password_reset_request_view(request):
    """
    Request password reset (generates token and sends email)
    POST /api/password/reset-request/
    Body: {employee_id}
    """
    serializer = PasswordResetRequestSerializer(data=request.data)
    
    if serializer.is_valid():
        employee_id = serializer.validated_data['employee_id']
        user = User.objects.get(employee_id=employee_id, is_active=True)
        
        # Create reset token
        reset_token_obj = PasswordResetToken.create_for_user(user)
        
        # Send email
        email_sent = send_password_reset_email(user, reset_token_obj.token)
        
        return Response(
            {
                'message': 'Password reset email sent successfully',
                'email_sent': email_sent
            },
            status=status.HTTP_200_OK
        )
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def password_reset_confirm_view(request):
    """
    Confirm password reset with token
    POST /api/password/reset-confirm/
    Body: {token, new_password, confirm_password}
    """
    serializer = PasswordResetConfirmSerializer(data=request.data)
    
    if serializer.is_valid():
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']
        
        try:
            reset_token = PasswordResetToken.objects.get(token=token)
        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired reset token'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not reset_token.is_valid():
            return Response(
                {'error': 'Reset token has expired or already been used'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Reset password
        user = reset_token.user
        user.set_password(new_password)
        user.password_must_change = False
        user.last_password_change = timezone.now()
        user.save()
        
        # Mark token as used
        reset_token.mark_as_used()
        
        # Send notification
        send_password_changed_notification(user)
        
        return Response(
            {'message': 'Password reset successfully'},
            status=status.HTTP_200_OK
        )
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def validate_reset_token_view(request, token):
    """
    Validate if reset token is valid
    GET /api/password/validate-token/<token>/
    """
    try:
        reset_token = PasswordResetToken.objects.get(token=token)
        if reset_token.is_valid():
            return Response(
                {'valid': True, 'employee_id': reset_token.user.employee_id},
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {'valid': False, 'error': 'Token expired or already used'},
                status=status.HTTP_400_BAD_REQUEST
            )
    except PasswordResetToken.DoesNotExist:
        return Response(
            {'valid': False, 'error': 'Invalid token'},
            status=status.HTTP_404_NOT_FOUND
        )


# ============================================
# PROFILE ENDPOINTS
# ============================================

@api_view(['GET'])
@authenticated_required
def get_profile_view(request):
    """
    Get own profile
    GET /api/profile/
    """
    serializer = UserSerializer(request.user)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['PUT', 'PATCH'])
@authenticated_required
def update_profile_view(request):
    """
    Update own profile (limited fields)
    PUT/PATCH /api/profile/
    Body: {full_name, email, phone}
    """
    allowed_fields = ['full_name', 'email', 'phone']
    data = {k: v for k, v in request.data.items() if k in allowed_fields}
    
    serializer = UserUpdateSerializer(request.user, data=data, partial=True)
    
    if serializer.is_valid():
        serializer.save()
        return Response(
            {
                'message': 'Profile updated successfully',
                'user': UserSerializer(request.user).data
            },
            status=status.HTTP_200_OK
        )
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ============================================
# UTILITY ENDPOINTS
# ============================================

@api_view(['GET'])
@superuser_required
def check_employee_id_view(request, employee_id):
    """
    Check if employee_id is available
    GET /api/users/check-employee-id/<employee_id>/
    """
    exists = User.objects.filter(employee_id=employee_id).exists()
    return Response(
        {'available': not exists},
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
@superuser_required
def check_email_view(request, email):
    """
    Check if email is available
    GET /api/users/check-email/<email>/
    """
    exists = User.objects.filter(email=email).exists()
    return Response(
        {'available': not exists},
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
@superuser_required
def user_stats_view(request):
    """
    Get user statistics
    GET /api/users/stats/
    """
    total_users = User.objects.count()
    active_users = User.objects.filter(is_active=True).count()
    hod_count = User.objects.filter(role='HOD', is_active=True).count()
    store_keeper_count = User.objects.filter(role='Store Keeper', is_active=True).count()
    staff_count = User.objects.filter(role='Staff', is_active=True).count()
    
    return Response(
        {
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': total_users - active_users,
            'roles': {
                'HOD': hod_count,
                'Store Keeper': store_keeper_count,
                'Staff': staff_count
            }
        },
        status=status.HTTP_200_OK
    )
