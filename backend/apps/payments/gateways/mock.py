"""A stand-in gateway for development until a real provider is chosen.

It behaves like a real one: webhooks are HMAC-SHA256 signed with PAYMENT_WEBHOOK_SECRET
and go through the same verification and handling code a real webhook would.
"""
import hashlib
import hmac
import json
from decimal import Decimal, InvalidOperation

from django.conf import settings

from .base import CheckoutSession, InvalidWebhook, PaymentGateway, WebhookEvent

SIGNATURE_HEADER = "X-Loprig-Signature"


def sign(body: bytes) -> str:
    return hmac.new(settings.PAYMENT_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()


class MockGateway(PaymentGateway):
    name = "mock"

    def create_checkout(self, payment) -> CheckoutSession:
        url = f"{settings.FRONTEND_URL}/checkout/{payment.course.slug}?payment={payment.reference}"
        return CheckoutSession(checkout_url=url, provider_reference=f"mock_{payment.reference}")

    def parse_webhook(self, body: bytes, headers) -> WebhookEvent:
        signature = headers.get(SIGNATURE_HEADER, "")
        if not signature or not hmac.compare_digest(sign(body), signature):
            raise InvalidWebhook("Invalid signature.")
        try:
            data = json.loads(body)
            return WebhookEvent(
                reference=data["reference"],
                succeeded=data["status"] == "succeeded",
                amount=Decimal(str(data["amount"])),
                currency=data["currency"],
                provider_reference=data.get("provider_reference", ""),
                failure_reason=data.get("reason", ""),
                raw=data,
            )
        except (ValueError, KeyError, TypeError, InvalidOperation) as exc:
            raise InvalidWebhook("Malformed payload.") from exc

    def build_event(self, payment, succeeded: bool) -> tuple[bytes, dict]:
        """What the gateway would POST to our webhook after the customer pays (or fails to)."""
        body = json.dumps({
            "reference": payment.reference,
            "provider_reference": payment.provider_reference,
            "status": "succeeded" if succeeded else "failed",
            "amount": str(payment.amount),
            "currency": payment.currency,
            "reason": "" if succeeded else "Card declined (simulated).",
        }).encode()
        return body, {SIGNATURE_HEADER: sign(body)}
