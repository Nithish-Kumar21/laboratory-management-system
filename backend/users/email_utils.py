import logging
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email, employee_id, reset_token, frontend_url):
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    subject = 'GNC Chemistry Lab — Password Reset Request'
    message = f"""Hello {employee_id},

We received a request to reset your password for the GNC Chemistry Lab Management System.

Click the link below to reset your password (expires in 30 minutes):
{reset_link}

If you did not request this, ignore this email. Your password will not change.

---
GNC Chemistry Lab Management System
Guru Nanak College (PG and Research Programme)
Department of Chemistry"""

    try:
        sent = send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=False,
        )
        logger.info("Email sent to %s — result: %s", to_email, sent)
        return sent == 1
    except Exception as e:
        logger.error("Email send failed — %s: %s", type(e).__name__, e)
        return False


def send_welcome_email(to_email, employee_id, role, login_token, frontend_url):
    login_link = f"{frontend_url}/reset-password?token={login_token}"

    subject = 'Welcome to GNC Chemistry Lab Management System'
    message = f"""Hello {employee_id},

Your account has been created on the GNC Chemistry Lab Management System.

Your Login Details:
  Employee ID : {employee_id}
  Role        : {role}

To set your password and activate your account, click the link below (expires in 24 hours):
{login_link}

After setting your password, you can log in at: {frontend_url}/login

If you did not expect this email, please contact your HOD.

---
GNC Chemistry Lab Management System
Guru Nanak College (PG and Research Programme)
Department of Chemistry"""

    try:
        sent = send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=False,
        )
        logger.info("Welcome email sent to %s — result: %s", to_email, sent)
        return sent == 1
    except Exception as e:
        logger.error("Welcome email failed — %s: %s", type(e).__name__, e)
        return False
