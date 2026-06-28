from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone
from datetime import timedelta
import secrets
import random
import string


class UserManager(BaseUserManager):
    def create_user(self, employee_id, email, full_name, password=None, **extra_fields):
        if not employee_id:
            raise ValueError('Employee ID is required')
        if not email:
            raise ValueError('Email is required')
        if not full_name:
            raise ValueError('Full name is required')
        
        email = self.normalize_email(email)
        user = self.model(
            employee_id=employee_id,
            email=email,
            full_name=full_name,
            **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, employee_id, email, full_name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('password_must_change', False)
        extra_fields.setdefault('role', 'hod')
        extra_fields.setdefault('department', 'B.Sc Chemistry')
        extra_fields.setdefault('designation', 'System Administrator')
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True')
        
        return self.create_user(employee_id, email, full_name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('hod', 'Head of Department'),
        ('store_keeper', 'Store Keeper'),
        ('staff', 'Staff'),
    ]
    
    DEPARTMENT_CHOICES = [
        ('B.Sc Chemistry', 'B.Sc Chemistry'),
        ('M.Sc Chemistry', 'M.Sc Chemistry'),
    ]
    
    employee_id = models.CharField(
        max_length=20,
        unique=True,
        validators=[
            RegexValidator(
                regex=r'^[A-Za-z0-9_\-]+$',
                message='Employee ID must contain only letters, numbers, underscores, and hyphens'
            )
        ]
    )
    
    full_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    
    phone_regex = RegexValidator(
        regex=r'^\+91[0-9]{10}$',
        message='Phone number must be in format: +91XXXXXXXXXX'
    )
    phone = models.CharField(max_length=13, unique=True, validators=[phone_regex])
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    designation = models.CharField(max_length=50)
    department = models.CharField(max_length=30, choices=DEPARTMENT_CHOICES)
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    
    password_must_change = models.BooleanField(default=True)
    is_first_login = models.BooleanField(default=False)
    degree = models.CharField(max_length=50, null=True, blank=True)
    last_password_change = models.DateTimeField(null=True, blank=True)
    
    failed_login_attempts = models.IntegerField(default=0)
    account_locked_until = models.DateTimeField(null=True, blank=True)
    
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_users'
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'employee_id'
    REQUIRED_FIELDS = ['email', 'full_name']
    
    class Meta:
        db_table = 'user_account'
        managed = False
    
    def __str__(self):
        return f"{self.employee_id} - {self.full_name}"
    
    def is_account_locked(self):
        if self.account_locked_until and timezone.now() < self.account_locked_until:
            return True
        if self.account_locked_until and timezone.now() >= self.account_locked_until:
            self.reset_failed_attempts()
        return False
    
    def increment_failed_attempts(self):
        from django.conf import settings
        
        self.failed_login_attempts += 1
        
        max_attempts = getattr(settings, 'MAX_FAILED_LOGIN_ATTEMPTS', 5)
        lockout_minutes = getattr(settings, 'ACCOUNT_LOCKOUT_DURATION', 30)
        
        if self.failed_login_attempts >= max_attempts:
            self.account_locked_until = timezone.now() + timedelta(minutes=lockout_minutes)
        
        self.save(update_fields=['failed_login_attempts', 'account_locked_until'])
    
    def reset_failed_attempts(self):
        self.failed_login_attempts = 0
        self.account_locked_until = None
        self.save(update_fields=['failed_login_attempts', 'account_locked_until'])
    
    @staticmethod
    def generate_secure_password():
        length = random.randint(10, 12)
        uppercase = random.choice(string.ascii_uppercase)
        lowercase = random.choice(string.ascii_lowercase)
        digit = random.choice(string.digits)
        special = random.choice('@#$%&*')
        all_chars = string.ascii_letters + string.digits + '@#$%&*'
        remaining = ''.join(random.choices(all_chars, k=length - 4))
        password_list = list(uppercase + lowercase + digit + special + remaining)
        random.shuffle(password_list)
        return ''.join(password_list)


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reset_tokens')
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'password_reset_token'
        managed = False
    
    def __str__(self):
        return f"Reset token for {self.user.employee_id}"
    
    def is_valid(self):
        return not self.used and timezone.now() < self.expires_at
    
    def mark_as_used(self):
        self.used = True
        self.save(update_fields=['used'])
    
    @staticmethod
    def create_for_user(user):
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=1)
        return PasswordResetToken.objects.create(
            user=user,
            token=token,
            expires_at=expires_at
        )
