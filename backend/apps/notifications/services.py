import logging

from django.core.mail import send_mail

from .models import Notification

logger = logging.getLogger(__name__)


def notify(user, kind: str, title: str, message: str = "", data: dict | None = None, email: bool = False) -> Notification:
    """Store an in-app notification and optionally email it.

    Email is sent inline for now; move it to a Celery task once Celery + Redis are added,
    so a slow mail server never slows down the request that triggered it.
    """
    notification = Notification.objects.create(user=user, kind=kind, title=title, message=message, data=data or {})
    if email:
        try:
            send_mail(subject=title, message=message, from_email=None, recipient_list=[user.email])
        except Exception:  # A failed email must never undo an enrollment or payment.
            logger.exception("Failed to email notification %s to user %s", notification.pk, user.pk)
    return notification
