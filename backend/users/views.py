from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from .models import User, PasswordResetToken
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer
)
import secrets
from datetime import timedelta




class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({'error': 'Employee ID and password are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check account lockout before authenticate (custom backend returns None for locked too)
        try:
            u = User.objects.get(employee_id=username)
            if u.is_account_locked():
                return Response({'error': 'Account is temporarily locked. Try again later.'}, status=status.HTTP_403_FORBIDDEN)
            if not u.is_active:
                return Response({'error': 'Account is inactive'}, status=status.HTTP_403_FORBIDDEN)
        except User.DoesNotExist:
            pass
        
        user = authenticate(request, username=username, password=password)
        
        if user is None:
            return Response({'error': 'Invalid employee ID or password'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Password changed successfully'}, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        
        if not email:
            return Response({'error': 'Email required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
            
            # Create reset token
            token = secrets.token_urlsafe(32)
            PasswordResetToken.objects.create(
                user=user,
                token=token,
                expires_at=timezone.now() + timedelta(hours=24)
            )
            
            # Send email
            reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
            send_mail(
                'Password Reset Request',
                f'Click here to reset your password: {reset_link}',
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=True,
            )
            
            return Response({'message': 'Password reset link sent to email'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'message': 'If email exists, reset link has been sent'}, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        
        if not token or not new_password:
            return Response({'error': 'Token and new password required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            reset_token = PasswordResetToken.objects.get(
                token=token,
                used=False,
                expires_at__gt=timezone.now()
            )
            
            user = reset_token.user
            user.set_password(new_password)
            user.save()
            
            reset_token.used = True
            reset_token.save()
            
            return Response({'message': 'Password reset successfully'}, status=status.HTTP_200_OK)
        except PasswordResetToken.DoesNotExist:
            return Response({'error': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)


class UserListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer
    
    def get_permissions(self):
        return [IsAuthenticated()]
    
    def get_queryset(self):
        # Only admins can see all users
        if self.request.user.role == 'admin':
            return User.objects.all().order_by('-date_joined')
        # Others see only themselves
        return User.objects.filter(id=self.request.user.id)
    
    def perform_create(self, serializer):
        # Only admin can create users
        if self.request.user.role != 'admin':
            raise PermissionDenied("Only admins can create users")
        serializer.save()


class UserRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer
    
    def get_object(self):
        user = super().get_object()
        # Users can edit themselves or admin can edit anyone
        if user.id != self.request.user.id and self.request.user.role != 'admin':
            raise PermissionDenied("You don't have permission to edit this user")
        return user
    
    def perform_update(self, serializer):
        # Only admins can change role and is_active
        if self.request.user.role != 'admin':
            serializer.save(
                role=self.get_object().role,
                is_active=self.get_object().is_active
            )
        else:
            serializer.save()
    
    def perform_destroy(self, instance):
        # Only admin can delete
        if self.request.user.role != 'admin':
            raise PermissionDenied("Only admins can delete users")
        instance.delete()


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
