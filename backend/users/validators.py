import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class CustomPasswordValidator:
    def validate(self, password, user=None):
        if len(password) < 8:
            raise ValidationError(
                _("Password must be at least 8 characters long."),
                code='password_too_short',
            )
        
        if len(password) > 128:
            raise ValidationError(
                _("Password cannot exceed 128 characters."),
                code='password_too_long',
            )
        
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                _("Password must contain at least one uppercase letter (A-Z)."),
                code='password_no_upper',
            )
        
        if not re.search(r'[a-z]', password):
            raise ValidationError(
                _("Password must contain at least one lowercase letter (a-z)."),
                code='password_no_lower',
            )
        
        if not re.search(r'[0-9]', password):
            raise ValidationError(
                _("Password must contain at least one digit (0-9)."),
                code='password_no_digit',
            )
        
        if not re.search(r'[@#$%&*]', password):
            raise ValidationError(
                _("Password must contain at least one special character (@, #, $, %, &, *)."),
                code='password_no_special',
            )
        
        if user and hasattr(user, 'employee_id'):
            if password.lower() == user.employee_id.lower():
                raise ValidationError(
                    _("Password cannot be the same as your Employee ID."),
                    code='password_same_as_employee_id',
                )
    
    def get_help_text(self):
        return _(
            "Your password must contain at least 8 characters, "
            "including uppercase, lowercase, digit, and special character (@#$%&*)."
        )
