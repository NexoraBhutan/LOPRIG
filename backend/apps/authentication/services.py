import hashlib
import hmac
import logging
import secrets
import smtplib
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import PasswordResetCode, User

from . import emails

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


def google_sign_in(credential: str) -> tuple[User, bool]:
    """Sign in (or sign up) with a Google ID token. Returns (user, created).

    An existing account with the same email signs in, whatever its role, so teachers and admins
    can use Google too. A new email gets a STUDENT account, exactly like the public sign-up form,
    with no usable password (they can set one later with "Forgot password").
    """
    from django.contrib.auth.models import update_last_login
    from rest_framework.exceptions import AuthenticationFailed

    from .google import sized_picture, verify_id_token

    claims = verify_id_token(credential)
    email = claims["email"].strip().lower()
    picture = sized_picture(claims.get("picture", ""))[:500]

    user = User.objects.filter(email__iexact=email).first()
    created = user is None
    if created:
        name = (claims.get("name") or email.split("@")[0]).strip()[:150]
        user = User.objects.create_user(email=email, password=None, name=name, role=User.Role.STUDENT)
    elif not user.is_active:
        raise AuthenticationFailed("This account has been deactivated. Please contact Lop-rig support.",
                                   code="user_inactive")
    elif user.is_site_admin:
        raise AuthenticationFailed(
            "This is a site administration account. Sign in at the site administration page instead.",
            code="site_admin_account",
        )

    if picture and picture != user.google_picture:
        user.google_picture = picture  # kept fresh; an uploaded photo still takes priority
        user.save(update_fields=["google_picture"])
    update_last_login(None, user)
    return user, created


def email_login_details(user: User, *, reset: bool = False) -> bool:
    """Give an admin-created (or reset) account a new temporary password and email it to the user.

    Nobody else ever sees the password. The user must replace it from their own account page
    before they can use the portal. Returns False if the email couldn't be sent; the account then
    keeps an unknown password and the admin can simply send the login email again.
    """
    password = user.set_temporary_password()
    if reset:
        sign_out_everywhere(user)
    try:
        emails.login_details(user, password, reset=reset)
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
    emails.password_reset_code(user, code, PasswordResetCode.LIFETIME_MINUTES)


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
        transaction.on_commit(lambda: emails.password_changed(user))
