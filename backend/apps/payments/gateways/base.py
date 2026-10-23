"""The contract every payment gateway adapter implements.

Adding Stripe or a local Bhutanese provider means writing one class with these two
methods and registering it in gateways/__init__.py. Nothing else changes.
"""
from dataclasses import dataclass, field
from decimal import Decimal


class InvalidWebhook(Exception):
    """Signature check failed or the payload is malformed. Never trust such a request."""


@dataclass
class CheckoutSession:
    checkout_url: str
    provider_reference: str


@dataclass
class WebhookEvent:
    reference: str
    succeeded: bool
    amount: Decimal
    currency: str
    provider_reference: str = ""
    failure_reason: str = ""
    raw: dict = field(default_factory=dict)


class PaymentGateway:
    name: str = ""

    def create_checkout(self, payment) -> CheckoutSession:
        raise NotImplementedError

    def parse_webhook(self, body: bytes, headers) -> WebhookEvent:
        """Verify the request really came from the gateway, then parse it. Raise InvalidWebhook if not."""
        raise NotImplementedError
