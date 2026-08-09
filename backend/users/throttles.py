from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


class ForgotPasswordThrottle(AnonRateThrottle):
    scope = 'forgot_password'


class ResetPasswordThrottle(AnonRateThrottle):
    scope = 'reset_password'
