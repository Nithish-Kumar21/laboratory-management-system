import logging
from .models import AuditLog

logger = logging.getLogger('lms')


class AuditLogService:

    @staticmethod
    def log(user, action, entity_type, entity_id=None, description='', request=None):
        try:
            ip_address = None
            if request:
                x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
                if x_forwarded_for:
                    ip_address = x_forwarded_for.split(',')[0].strip()
                else:
                    ip_address = request.META.get('REMOTE_ADDR')

            AuditLog.objects.create(
                user=user,
                action=action,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else None,
                description=description,
                ip_address=ip_address,
            )
            logger.info(f'AUDIT | {action} | {entity_type}#{entity_id} | {description}')
        except Exception:
            logger.exception(f'AUDIT LOG FAILED | {action} | {entity_type}#{entity_id} | {description}')
