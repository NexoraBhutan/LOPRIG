import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.courses.models import Course
from apps.enrollments import services as enrollment_services
from apps.notifications.models import Notification
from apps.notifications.services import notify

from .gateways import CheckoutSession, InvalidWebhook, MockGateway, get_gateway
from .models import Payment

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
