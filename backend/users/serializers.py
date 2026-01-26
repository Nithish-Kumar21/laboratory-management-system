from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model (read operations)"""
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'employee_id', 'full_name', 'email', 'phone',
            'role', 'designation', 'department', 'is_active',
            'password_must_change', 'date_joined', 'last_login',
            'created_by', 'created_by_name', 'updated_at'
        ]
        read_only_fields = [
            'id', 'date_joined', 'last_login', 'created_by',
            'created_by_name', 'updated_at'
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users"""
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        help_text='Leave blank to auto-generate secure password'
    )
    auto_generate_password = serializers.BooleanField(
        write_only=True,
        required=False,
        default=False
    )
    
    class Meta:
        model = User
        fields = [
            'employee_id', 'full_name', 'email', 'phone',
            'role', 'designation', 'department',
            'password', 'auto_generate_password'
        ]
    
    def validate_employee_id(self, value):
        if User.objects.filter(employee_id=value).exists():
            raise serializers.ValidationError(
                f"User with Employee ID '{value}' already exists."
            )
        return value
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                f"User with email '{value}' already exists."
            )
        return value
    
    def validate_phone(self, value):
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError(
                f"User with phone number '{value}' already exists."
            )
        return value
    
    def validate_role(self, value):
        if value == 'HOD':
            if User.objects.filter(role='HOD', is_active=True).exists():
                raise serializers.ValidationError(
                    "Only one HOD can exist in the system. "
                    "Please deactivate or change the role of the existing HOD first."
                )
        return value
    
    def validate(self, data):
        auto_generate = data.pop('auto_generate_password', False)
        password = data.get('password', '').strip()
        
        if auto_generate or not password:
            data['password'] = User.generate_secure_password()
        else:
            try:
                validate_password(password)
            except DjangoValidationError as e:
                raise serializers.ValidationError({'password': list(e.messages)})
        
        return data
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.password_must_change = True
        user.save()
        
        user._plain_password = password
        
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user details"""
    
    class Meta:
        model = User
        fields = [
            'full_name', 'email', 'phone', 'role',
            'designation', 'department', 'is_active'
        ]
    
    def validate_email(self, value):
        user = self.instance
        if User.objects.filter(email=value).exclude(id=user.id).exists():
            raise serializers.ValidationError(
                f"User with email '{value}' already exists."
            )
        return value
    
    def validate_phone(self, value):
        user = self.instance
        if User.objects.filter(phone=value).exclude(id=user.id).exists():
            raise serializers.ValidationError(
                f"User with phone number '{value}' already exists."
            )
        return value
    
    def validate_role(self, value):
        user = self.instance
        if value == 'HOD' and user.role != 'HOD':
            if User.objects.filter(role='HOD', is_active=True).exclude(id=user.id).exists():
                raise serializers.ValidationError(
                    "Only one HOD can exist in the system. "
                    "Please deactivate or change the role of the existing HOD first."
                )
        return value


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password"""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value
    
    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': "Passwords do not match."
            })
        
        try:
            validate_password(data['new_password'], user=self.context['request'].user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'new_password': list(e.messages)})
        
        return data
    
    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.password_must_change = False
        user.last_password_change = timezone.now()
        user.save()
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for requesting password reset"""
    employee_id = serializers.CharField(required=True)
    
    def validate_employee_id(self, value):
        try:
            User.objects.get(employee_id=value, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError("No active user found with this Employee ID.")
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for confirming password reset"""
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)
    
    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': "Passwords do not match."
            })
        
        try:
            validate_password(data['new_password'])
        except DjangoValidationError as e:
            raise serializers.ValidationError({'new_password': list(e.messages)})
        
        return data
