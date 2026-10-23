from django.conf import settings

from .base import CheckoutSession, InvalidWebhook, PaymentGateway, WebhookEvent
from .mock import MockGateway

GATEWAYS: dict[str, type[PaymentGateway]] = {
    MockGateway.name: MockGateway,
}


class UnknownGateway(Exception):
    pass


def get_gateway(name: str | None = None) -> PaymentGateway:
    name = name or settings.PAYMENT_PROVIDER
    try:
        return GATEWAYS[name]()
    except KeyError as exc:
        raise UnknownGateway(name) from exc


__all__ = [
    "CheckoutSession", "InvalidWebhook", "PaymentGateway", "WebhookEvent",
    "MockGateway", "UnknownGateway", "get_gateway",
]
