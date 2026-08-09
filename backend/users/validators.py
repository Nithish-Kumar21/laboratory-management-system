import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class PasswordComplexityValidator:
    def validate(self, password, user=None):
        if user is not None:
            employee_id = getattr(user, 'employee_id', None)
            if employee_id and str(password).lower() == str(employee_id).lower():
                raise ValidationError(
                    _('Password cannot be the same as your Employee ID.'),
                    code='password_same_as_employee_id',
                )
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                _('Password must contain at least one uppercase letter.'),
                code='password_no_upper',
            )
        if not re.search(r'[a-z]', password):
            raise ValidationError(
                _('Password must contain at least one lowercase letter.'),
                code='password_no_lower',
            )
        if not re.search(r'\d', password):
            raise ValidationError(
                _('Password must contain at least one digit.'),
                code='password_no_digit',
            )
        if not re.search(r'[@#$%&*]', password):
            raise ValidationError(
                _('Password must contain at least one special character (@#$%&*).'),
                code='password_no_special',
            )

    def get_help_text(self):
        return _(
            'Your password must contain at least 8 characters, '
            'one uppercase letter, one lowercase letter, '
            'one digit, and one special character (@#$%&*). '
            'It cannot be the same as your Employee ID.'
        )
