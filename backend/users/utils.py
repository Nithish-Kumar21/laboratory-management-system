from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string


def send_welcome_email(user, plain_password):
    """Send welcome email to newly created user"""
    subject = 'Welcome to Laboratory Management System'
    
    message = f"""
Dear {user.full_name},

Your account has been created successfully in the Laboratory Management System.

Login Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Employee ID: {user.employee_id}
Temporary Password: {plain_password}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Login URL: {settings.FRONTEND_URL}/login

🔒 IMPORTANT: For security reasons, you will be required to change your password on first login.

Your Account Details:
• Role: {user.get_role_display()}
• Department: {user.department}
• Designation: {user.designation}

If you have any questions, please contact the system administrator.

Best regards,
Laboratory Management System
    """
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Error sending welcome email: {e}")
        return False


def send_password_reset_email(user, reset_token):
    """Send password reset email"""
    subject = 'Password Reset Request'
    
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    
    message = f"""
Dear {user.full_name},

We received a request to reset your password for the Laboratory Management System.

Click the link below to reset your password:
{reset_link}

⏰ This link will expire in 1 hour.

If you did not request this password reset, please ignore this email or contact the administrator.

Employee ID: {user.employee_id}

Best regards,
Laboratory Management System
    """
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Error sending password reset email: {e}")
        return False


def send_password_changed_notification(user):
    """Send notification when password is changed"""
    subject = 'Password Changed Successfully'
    
    message = f"""
Dear {user.full_name},

Your password has been changed successfully.

If you did not make this change, please contact the system administrator immediately.

Changed on: {user.last_password_change.strftime('%Y-%m-%d %H:%M:%S')}
Employee ID: {user.employee_id}

Best regards,
Laboratory Management System
    """
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Error sending password changed notification: {e}")
        return False
