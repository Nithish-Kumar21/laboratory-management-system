import logging
from datetime import timedelta

from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import authenticate
from django.conf import settings
from django.utils import timezone
from .models import User, PasswordResetToken
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, FirstLoginChangePasswordSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer
)
from .email_utils import send_password_reset_email, send_welcome_email

logger = logging.getLogger(__name__)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {'error': 'Employee ID and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            u = User.objects.get(employee_id=username)
            if u.is_account_locked():
                return Response(
                    {'error': 'Account is temporarily locked. Try again later.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if not u.is_active:
                return Response(
                    {'error': 'Account is inactive'},
                    status=status.HTTP_403_FORBIDDEN
                )
        except User.DoesNotExist:
            pass

        user = authenticate(request, username=username, password=password)

        if user is None:
            return Response(
                {'error': 'Invalid employee ID or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if user.is_first_login:
            temp_token = AccessToken()
            temp_token['user_id'] = user.id
            temp_token['purpose'] = 'change_password'
            temp_token.set_exp(
                lifetime=timedelta(
                    minutes=settings.FIRST_LOGIN_TOKEN_EXPIRY_MINUTES
                )
            )

            return Response({
                'first_login': True,
                'message': 'You must change your password before continuing.',
                'user_id': user.id,
                'temp_token': str(temp_token),
            })

        refresh = RefreshToken.for_user(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({'message': 'Logged out successfully'})
        except Exception:
            return Response({'message': 'Logged out successfully'})


class ChangePasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        auth_header = request.headers.get('Authorization', '')
        bearer_token = None

        if auth_header.startswith('Bearer '):
            bearer_token = auth_header.split(' ', 1)[1]

        if bearer_token:
            try:
                token = AccessToken(bearer_token)
            except TokenError:
                return Response(
                    {'error': 'Invalid or expired token.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            purpose = token.get('purpose')

            # First-login flow via temp_token (purpose == 'change_password')
            if purpose == 'change_password':
                try:
                    user = User.objects.get(id=token['user_id'])
                except (User.DoesNotExist, KeyError):
                    return Response(
                        {'error': 'Invalid token.'},
                        status=status.HTTP_403_FORBIDDEN
                    )

                serializer = FirstLoginChangePasswordSerializer(
                    data=request.data,
                    context={'user': user}
                )
                if serializer.is_valid():
                    serializer.save()

                    refresh = RefreshToken.for_user(user)
                    return Response({
                        'message': 'Password changed successfully.',
                        'access': str(refresh.access_token),
                        'refresh': str(refresh),
                        'user': UserSerializer(user).data,
                    })

                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            # Regular access token — let DRF handle auth below
            pass

        # Authenticated user changing their own password
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Authentication required.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Password changed successfully.'})

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        employee_id = serializer.validated_data['employee_id']
        email = serializer.validated_data['email']

        try:
            user = User.objects.get(employee_id=employee_id, email__iexact=email, is_active=True)

            PasswordResetToken.objects.filter(user=user, used=False).delete()

            reset_token = PasswordResetToken.create_for_user(user)

            send_password_reset_email(
                to_email=user.email,
                employee_id=user.employee_id,
                reset_token=reset_token.token,
                frontend_url=settings.FRONTEND_URL,
            )
        except User.DoesNotExist:
            pass
        except Exception as e:
            logger.exception("ForgotPassword: email sending failed — %s: %s", type(e).__name__, e)

        return Response({
            'message': 'If your details are correct, a password reset link has been sent to your email.'
        })


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token_str = request.data.get('token')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not token_str or not new_password or not confirm_password:
            return Response(
                {'error': 'Token, new password, and confirm password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_password != confirm_password:
            return Response(
                {'error': 'Passwords do not match.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            reset_token = PasswordResetToken.objects.get(
                token=token_str,
                used=False,
                expires_at__gt=timezone.now()
            )
        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired reset link.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(new_password)
        except DjangoValidationError as e:
            return Response(
                {'new_password': list(e.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = reset_token.user

        if user.check_password(new_password):
            return Response(
                {'error': 'New password cannot be the same as the old password.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.password_must_change = False
        user.is_first_login = False
        user.last_password_change = timezone.now()
        user.save()

        reset_token.used = True
        reset_token.save()

        return Response({
            'message': 'Password reset successful. You can now log in.'
        })


class VerifyResetTokenView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        token_str = request.query_params.get('token')

        if not token_str:
            return Response(
                {'error': 'Token is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            reset_token = PasswordResetToken.objects.get(
                token=token_str,
                used=False,
                expires_at__gt=timezone.now()
            )
            return Response({'valid': True})
        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired reset link.'},
                status=status.HTTP_400_BAD_REQUEST
            )


class UserListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_queryset(self):
        if self.request.user.role == 'hod':
            return User.objects.all().order_by('-date_joined')
        return User.objects.filter(id=self.request.user.id)

    def perform_create(self, serializer):
        if self.request.user.role != 'hod':
            raise PermissionDenied("Only HODs can create users")
        user = serializer.save()

        try:
            reset_token = PasswordResetToken.create_for_user(user, expiry_hours=24)
            send_welcome_email(
                to_email=user.email,
                employee_id=user.employee_id,
                role=user.role,
                login_token=reset_token.token,
                frontend_url=settings.FRONTEND_URL,
            )
        except Exception as e:
            logger.exception("Welcome email failed for %s — %s: %s", user.employee_id, type(e).__name__, e)


class UserRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer

    def get_object(self):
        user = super().get_object()
        if user.id != self.request.user.id and self.request.user.role != 'hod':
            raise PermissionDenied("You don't have permission to edit this user")
        return user

    def perform_update(self, serializer):
        if self.request.user.role != 'hod':
            serializer.save(
                role=self.get_object().role,
                is_active=self.get_object().is_active
            )
        else:
            serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != 'hod':
            raise PermissionDenied("Only HODs can delete users")
        instance.delete()


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
