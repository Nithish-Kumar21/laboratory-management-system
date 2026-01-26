from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class EmployeeIDBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None or password is None:
            return None
        
        try:
            user = User.objects.get(employee_id=username)
        except User.DoesNotExist:
            User().set_password(password)
            return None
        
        if not user.is_active:
            return None
        
        if user.is_account_locked():
            return None
        
        if user.check_password(password):
            user.reset_failed_attempts()
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])
            return user
        else:
            user.increment_failed_attempts()
            return None
    
    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
