import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

import re

from rest_framework.exceptions import APIException, ValidationError

from apps.courses.models import Course
from apps.enrollments import services as enrollment_services
from apps.users.models import User
from apps.notifications.models import Notification
from apps.notifications.services import notify

from .gateways import CheckoutSession, InvalidWebhook, MockGateway, get_gateway
from . import emails
from .files import check_image
from .models import Payment, PaymentSettings

logger = logging.getLogger(__name__)


@transaction.atomic
def start_checkout(student, course: Course) -> tuple[Payment, CheckoutSession]:
    """Create (or reuse) a pending payment for a paid course and open a gateway checkout."""
    enrollment = enrollment_services.get_or_create_pending(student, course)
    gateway = get_gateway()
    amount = course.current_price

    payment = Payment.objects.filter(
        enrollment=enrollment, status=Payment.Status.PENDING, provider=gateway.name, amount=amount
    ).first()
    if payment is None:
        # A pending payment at an old price must never be completed.
        Payment.objects.filter(enrollment=enrollment, status=Payment.Status.PENDING).update(
            status=Payment.Status.CANCELLED
        )
        payment = Payment.objects.create(
            student=student, course=course, enrollment=enrollment,
            amount=amount, currency=settings.PAYMENT_CURRENCY, provider=gateway.name,
        )

    session = gateway.create_checkout(payment)
    if payment.provider_reference != session.provider_reference:
        payment.provider_reference = session.provider_reference
        payment.save(update_fields=["provider_reference", "updated_at"])
    return payment, session


def handle_webhook(provider: str, body: bytes, headers) -> Payment:
    """Verify a gateway callback and apply it. The only path that can activate a paid enrollment.

    Raises InvalidWebhook (signature, payload or unknown payment); replays are ignored.
    """
    gateway = get_gateway(provider)
    event = gateway.parse_webhook(body, headers)

    with transaction.atomic():
        payment = (
            Payment.objects.select_for_update()
            .select_related("course", "student", "enrollment")
            .filter(reference=event.reference, provider=gateway.name)
            .first()
        )
        if payment is None:
            raise InvalidWebhook("Unknown payment reference.")
        if payment.status != Payment.Status.PENDING:
            return payment  # Gateways retry webhooks; handling must be idempotent.

        payment.raw_event = event.raw
        if event.provider_reference:
            payment.provider_reference = event.provider_reference

        if event.succeeded and (event.amount != payment.amount or event.currency != payment.currency):
            logger.warning("Payment %s amount mismatch: got %s %s", payment.reference, event.amount, event.currency)
            payment.status = Payment.Status.FAILED
            payment.failure_reason = "Amount or currency did not match the order."
            payment.save()
            return payment

        if event.succeeded:
            payment.status = Payment.Status.SUCCEEDED
            payment.paid_at = timezone.now()
            payment.save()
            enrollment_services.activate(payment.enrollment)
            notify(
                payment.student, Notification.Kind.PAYMENT, "Payment received",
                f"We received Nu. {payment.amount} for {payment.course.title}.",
                data={"course": payment.course.slug, "payment": payment.reference},
            )
        else:
            payment.status = Payment.Status.FAILED
            payment.failure_reason = event.failure_reason or "The payment was not completed."
            payment.save()
            notify(
                payment.student, Notification.Kind.PAYMENT, "Payment failed",
                f"Your payment for {payment.course.title} did not go through. You can try again.",
                data={"course": payment.course.slug, "payment": payment.reference},
            )
    return payment


def simulate_mock_payment(payment: Payment, succeeded: bool) -> Payment:
    """Development only: act as the mock gateway and send ourselves a signed webhook."""
    body, headers = MockGateway().build_event(payment, succeeded)
    return handle_webhook(MockGateway.name, body, headers)


# --- Bank QR payments (manual verification) -------------------------------------------------

JOURNAL_NUMBER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 /-]{3,38}[A-Za-z0-9]$")
BHUTAN_PHONE = re.compile(r"^(?:\+?975)?(\d{8})$")


def normalise_phone(value: str) -> str:
    """'+975 17-12 34 56' -> '17123456'. Empty string if it isn't an 8-digit Bhutanese number."""
    match = BHUTAN_PHONE.match(re.sub(r"[\s().-]", "", value or ""))
    return match.group(1) if match else ""


class AlreadySubmitted(APIException):
    status_code = 409
    default_detail = "Your payment for this course is already waiting for verification."
    default_code = "payment_under_review"


class AlreadyPaid(APIException):
    status_code = 409
    default_detail = "You have already paid for this course."
    default_code = "already_paid"


def normalise_journal(value: str) -> str:
    return re.sub(r"\s+", "", value or "").upper()


@transaction.atomic
def submit_qr_payment(student, course: Course, journal_number: str, proof, contact_number: str) -> Payment:
    """The student paid by QR: record the journal number + screenshot for an admin to check."""
    if course.status != Course.Status.PUBLISHED:
        raise ValidationError({"course": "This course isn't open for enrollment."})
    if not PaymentSettings.load().is_ready:
        raise ValidationError({"detail": "QR payments aren't set up yet. Please try again later."})
    journal = normalise_journal(journal_number)
    if not JOURNAL_NUMBER.match(journal):
        raise ValidationError({"journal_number": "Enter the journal number exactly as it appears on your receipt."})
    phone = normalise_phone(contact_number)
    if not phone:
        raise ValidationError({"contact_number": "Enter your 8-digit mobile number, e.g. 17123456."})
    check_image(proof, "proof")

    enrollment = enrollment_services.get_or_create_pending(student, course)  # refuses free/owned courses
    if Payment.objects.filter(enrollment=enrollment, status=Payment.Status.PENDING).exists():
        raise AlreadySubmitted()
    if Payment.objects.filter(journal_number=journal, status__in=[Payment.Status.PENDING, Payment.Status.SUCCEEDED]).exists():
        raise ValidationError({"journal_number": "This journal number has already been used for a payment."})

    # Any unfinished attempt at an older price can't be completed any more.
    Payment.objects.filter(enrollment=enrollment, status=Payment.Status.PENDING).update(status=Payment.Status.CANCELLED)
    payment = Payment.objects.create(
        student=student, course=course, enrollment=enrollment, amount=course.current_price,
        currency=settings.PAYMENT_CURRENCY, provider=Payment.QR, journal_number=journal, proof=proof,
        contact_number=phone,
    )
    for admin in User.objects.filter(role=User.Role.ADMIN, is_active=True):
        notify(
            admin, Notification.Kind.PAYMENT, "Payment to verify",
            f"{student.name} paid Nu. {payment.amount:,.0f} for “{course.title}” (journal {journal}).",
            data={"payment": payment.reference, "course": course.slug},
        )
    emails.after_commit(emails.payment_submitted, payment)
    return payment


def _lock_pending_qr(payment: Payment) -> Payment:
    payment = Payment.objects.select_for_update().select_related("course", "student", "enrollment").get(pk=payment.pk)
    if payment.provider not in (Payment.QR, Payment.RMA) or payment.status != Payment.Status.PENDING:
        raise ValidationError({"detail": "Only payments waiting for verification can be approved or rejected."})
    return payment


@transaction.atomic
def approve_qr_payment(payment: Payment, admin) -> Payment:
    payment = _lock_pending_qr(payment)
    payment.status = Payment.Status.SUCCEEDED
    payment.paid_at = payment.reviewed_at = timezone.now()
    payment.reviewed_by = admin
    payment.failure_reason = ""
    payment.save()
    enrollment_services.activate(payment.enrollment)
    notify(
        payment.student, Notification.Kind.PAYMENT, "Payment confirmed",
        f"Your payment of Nu. {payment.amount:,.0f} was verified. “{payment.course.title}” is unlocked.",
        data={"course": payment.course.slug, "payment": payment.reference},
    )
    emails.after_commit(emails.payment_approved, payment)
    return payment


@transaction.atomic
def reject_qr_payment(payment: Payment, admin, reason: str) -> Payment:
    payment = _lock_pending_qr(payment)
    payment.status = Payment.Status.FAILED
    payment.failure_reason = reason.strip()
    payment.reviewed_at = timezone.now()
    payment.reviewed_by = admin
    payment.save()
    notify(
        payment.student, Notification.Kind.PAYMENT, "Payment not verified",
        f"We couldn't verify your payment for “{payment.course.title}”: {payment.failure_reason} "
        "You can submit it again from the course page.",
        data={"course": payment.course.slug, "payment": payment.reference},
    )
    emails.after_commit(emails.payment_rejected, payment)
    return payment


# --- Bank account payments (RMA payment gateway) ------------------------------------------------

BANK_NAMES = {
    "dk": "DK", "bob": "Bank of Bhutan", "bdbl": "Bhutan Development Bank", "bnb": "Bhutan National Bank",
    "drukpnb": "Druk PNB", "gerab": "Gerab Financials Ltd", "tbank": "T-Bank",
}


@transaction.atomic
def record_bank_payment(student, course: Course, *, bank: str, account_last4: str, purpose: str, remarks: str,
                        transaction_id: str) -> Payment:
    """The student paid from their bank account. Record it, email their receipt, and ask an admin to unlock.

    One payment per course: while a payment is waiting or done, paying again is refused.
    """
    if settings.RMA_GATEWAY_MODE != "preview":
        # The live RMA integration (where the server itself confirms the debit with the bank) isn't built yet.
        raise ValidationError({"detail": "Paying from a bank account isn't available yet. Please pay by QR."})
    if course.status != Course.Status.PUBLISHED:
        raise ValidationError({"course": "This course isn't open for enrollment."})
    if bank not in BANK_NAMES:
        raise ValidationError({"bank": "Choose one of the listed banks."})

    enrollment = enrollment_services.get_or_create_pending(student, course)  # refuses free/owned courses
    if Payment.objects.filter(enrollment=enrollment, status__in=[Payment.Status.PENDING, Payment.Status.SUCCEEDED]).exists():
        raise AlreadyPaid()
    reference = transaction_id.strip().upper()
    if Payment.objects.filter(journal_number=reference, status__in=[Payment.Status.PENDING, Payment.Status.SUCCEEDED]).exists():
        raise AlreadyPaid("This bank transaction has already been used for a payment.")

    payment = Payment.objects.create(
        student=student, course=course, enrollment=enrollment, amount=course.current_price,
        currency=settings.PAYMENT_CURRENCY, provider=Payment.RMA, provider_reference=reference,
        # The bank's transaction reference doubles as the journal number admins search and check.
        journal_number=reference, paid_at=timezone.now(),
        raw_event={
            "bank": bank, "bank_name": BANK_NAMES[bank], "account_last4": account_last4,
            "purpose": purpose.strip(), "remarks": remarks.strip(), "test": settings.RMA_GATEWAY_MODE == "preview",
        },
    )
    for admin in User.objects.filter(role=User.Role.ADMIN, is_active=True):
        notify(
            admin, Notification.Kind.PAYMENT, "Bank payment: unlock the course",
            f"{student.name} paid Nu. {payment.amount:,.0f} from {BANK_NAMES[bank]} for “{course.title}”.",
            data={"payment": payment.reference, "course": course.slug},
        )
    emails.after_commit(emails.bank_payment_received, payment)
    emails.after_commit(emails.bank_payment_alert, payment)
    return payment
