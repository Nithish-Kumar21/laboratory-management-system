from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'employee_id', 'full_name', 'email', 'phone',
            'role', 'designation', 'department', 'is_active',
            'is_first_login', 'password_must_change', 'date_joined', 'last_login',
            'created_by', 'created_by_name', 'updated_at'
        ]
        read_only_fields = [
            'id', 'date_joined', 'last_login', 'created_by',
            'created_by_name', 'updated_at'
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True,
        help_text='Leave blank to auto-generate secure password'
    )
    auto_generate_password = serializers.BooleanField(
        write_only=True, required=False, default=False
    )

    class Meta:
        model = User
        fields = [
            'employee_id', 'full_name', 'email', 'phone',
            'role', 'designation', 'department', 'is_active',
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
        if value == 'hod':
            if User.objects.filter(role='hod', is_active=True).exists():
                raise serializers.ValidationError(
                    "Only one HOD can exist in the system. "
                    "Please deactivate or change the role of the existing HOD first."
                )
        if value == 'store_keeper':
            if User.objects.filter(role='store_keeper', is_active=True).exists():
                raise serializers.ValidationError(
                    "Only one Store Keeper can exist in the system. "
                    "Please deactivate or change the role of the existing Store Keeper first."
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
            data['password'] = password

        return data

    def create(self, validated_data):
        password = validated_data.pop('password')

        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user

        user = User.objects.create_user(password=password, **validated_data)
        user.password_must_change = True
        user.is_first_login = True
        user.save()

        user._plain_password = password

        return user


class UserUpdateSerializer(serializers.ModelSerializer):
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
        if value == 'hod' and user.role != 'hod':
            if User.objects.filter(role='hod', is_active=True).exclude(id=user.id).exists():
                raise serializers.ValidationError(
                    "Only one HOD can exist in the system. "
                    "Please deactivate or change the role of the existing HOD first."
                )
        if value == 'store_keeper' and user.role != 'store_keeper':
            if User.objects.filter(role='store_keeper', is_active=True).exclude(id=user.id).exists():
                raise serializers.ValidationError(
                    "Only one Store Keeper can exist in the system. "
                    "Please deactivate or change the role of the existing Store Keeper first."
                )
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user

        if user.check_password(value):
            return value

        if user.check_password(value.strip()):
            return value.strip()

        if user.password_must_change or user.is_first_login:
            return value

        raise serializers.ValidationError("Old password is incorrect.")

    def validate_new_password(self, value):
        user = self.context['request'].user

        if user.check_password(value):
            raise serializers.ValidationError("New password cannot be the same as the current password.")

        return value

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

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.password_must_change = False
        user.is_first_login = False
        user.last_password_change = timezone.now()
        user.save()
        return user


class FirstLoginChangePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate_new_password(self, value):
        user = self.context['user']
        if user and user.check_password(value):
            raise serializers.ValidationError("New password cannot be the same as the current password.")
        return value

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

    def save(self):
        user = self.context['user']
        user.set_password(self.validated_data['new_password'])
        user.password_must_change = False
        user.is_first_login = False
        user.last_password_change = timezone.now()
        user.save()
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    employee_id = serializers.CharField(required=True)
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate_new_password(self, value):
        return value

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
