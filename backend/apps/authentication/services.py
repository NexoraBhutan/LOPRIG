import hashlib
import hmac
import logging
import secrets
import smtplib
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import PasswordResetCode, User

logger = logging.getLogger(__name__)

INVALID_CODE = "This code is incorrect or has expired. Request a new one."
TOO_MANY = "Too many wrong attempts. Request a new code."


def issue_tokens(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def sign_out_everywhere(user: User) -> None:
    """Revoke every refresh token the user holds, so all their sessions end."""
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def email_login_details(user: User, *, reset: bool = False) -> bool:
    """Give an admin-created (or reset) account a new temporary password and email it to the user.

    Nobody else ever sees the password. The user must replace it from their own account page
    before they can use the portal. Returns False if the email couldn't be sent; the account then
    keeps an unknown password and the admin can simply send the login email again.
    """
    password = user.set_temporary_password()
    if reset:
        sign_out_everywhere(user)
    login_url = f"{settings.FRONTEND_URL.rstrip('/')}/login"
    sent_at = timezone.localtime().strftime("%d %b %Y, %I:%M %p")
    intro = (
        "An admin has reset your Lop-rig password. Your old password no longer works."
        if reset else
        f"An admin has created your Lop-rig {user.get_role_display().lower()} account."
    )
    try:
        send_mail(
            # The time keeps Gmail from threading several resets together, so the newest is easy to find.
            subject=(f"Your new Lop-rig login details ({sent_at})" if reset
                     else f"Welcome to Lop-rig: your login details ({sent_at})"),
            message=(
                f"Hi {user.name},\n\n"
                f"{intro}\n\n"
                f"Log in at: {login_url}\n"
                f"Email: {user.email}\n"
                f"Temporary password: {password}\n\n"
                f"Sent {sent_at}. This replaces any earlier Lop-rig login email: only this newest password works.\n"
                "Type or paste the password exactly, without spaces before or after it.\n\n"
                "After you log in you'll be asked to set your own password before you can continue.\n"
                "Never share your password with anyone, including Lop-rig staff."
            ),
            from_email=None,
            recipient_list=[user.email],
        )
    except (smtplib.SMTPException, OSError):
        logger.exception("Could not send login details to %s", user.email)
        return False
    return True


def _hash_code(user_id: int, code: str) -> str:
    """Keyed hash so a leaked database row can't be turned back into a usable code."""
    return hmac.new(settings.SECRET_KEY.encode(), f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def _website_user(email: str) -> User | None:
    """Active website account for this email. Site administrators reset through Django instead."""
    return (
        User.objects.filter(email__iexact=email.strip(), is_active=True, is_staff=False, is_superuser=False)
        .exclude(role=User.Role.SITE_ADMIN)
        .first()
    )


def send_password_reset(email: str) -> None:
    """Email a 6-digit code if the account exists. Silent otherwise, so emails can't be enumerated.

    Requesting a new code cancels any earlier one.
    """
    user = _website_user(email)
    if user is None:
        return
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = timezone.now()
    with transaction.atomic():
        PasswordResetCode.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
        PasswordResetCode.objects.create(
            user=user,
            code_hash=_hash_code(user.pk, code),
            expires_at=now + timedelta(minutes=PasswordResetCode.LIFETIME_MINUTES),
        )
    send_mail(
        subject=f"{code} is your Lop-rig reset code",
        message=(
            f"Hi {user.name},\n\n"
            f"Your Lop-rig password reset code is: {code}\n\n"
            f"Enter it on the reset page within {PasswordResetCode.LIFETIME_MINUTES} minutes.\n"
            "If you did not ask for this, you can ignore this email. Never share this code with anyone."
        ),
        from_email=None,
        recipient_list=[user.email],
    )


def reset_password(email: str, code: str, new_password: str) -> None:
    """Check the emailed code and set the new password. Signs the user out on every device."""
    user = _website_user(email)
    entry = (
        PasswordResetCode.objects.filter(user=user, used_at__isnull=True, expires_at__gt=timezone.now()).first()
        if user else None
    )
    if entry is None:
        raise ValidationError({"code": INVALID_CODE})
    if entry.attempts >= PasswordResetCode.MAX_ATTEMPTS:
        raise ValidationError({"code": TOO_MANY})

    if not hmac.compare_digest(entry.code_hash, _hash_code(user.pk, code.strip())):
        # Counted immediately (outside any transaction) so a rejected guess can't be rolled back.
        PasswordResetCode.objects.filter(pk=entry.pk).update(attempts=F("attempts") + 1)
        left = PasswordResetCode.MAX_ATTEMPTS - entry.attempts - 1
        raise ValidationError({"code": f"That code is incorrect. {left} attempt{'s' if left != 1 else ''} left."
                               if left > 0 else TOO_MANY})

    try:
        validate_password(new_password, user)
    except DjangoValidationError as exc:
        raise ValidationError({"new_password": list(exc.messages)})

    with transaction.atomic():
        # Lock and re-check so the same code can't be used twice by parallel requests.
        entry = PasswordResetCode.objects.select_for_update().get(pk=entry.pk)
        if entry.used_at is not None:
            raise ValidationError({"code": INVALID_CODE})
        entry.used_at = timezone.now()
        entry.save(update_fields=["used_at"])
        user.set_own_password(new_password)
        # Anyone still logged in with the old password is signed out.
        sign_out_everywhere(user)
