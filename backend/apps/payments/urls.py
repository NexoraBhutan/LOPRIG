from django.urls import path

from .views import (
    CheckoutView,
    MockPayView,
    PaymentDetailView,
    PaymentListView,
    PaymentWebhookView,
    QrSettingsView,
    QrSubmitView,
)

urlpatterns = [
    path("", PaymentListView.as_view(), name="payment-list"),
    path("checkout/", CheckoutView.as_view(), name="payment-checkout"),
    path("qr/", QrSettingsView.as_view(), name="payment-qr"),
    path("qr/submit/", QrSubmitView.as_view(), name="payment-qr-submit"),
    path("webhooks/<str:provider>/", PaymentWebhookView.as_view(), name="payment-webhook"),
    path("mock/<str:reference>/pay/", MockPayView.as_view(), name="payment-mock-pay"),
    path("<str:reference>/", PaymentDetailView.as_view(), name="payment-detail"),
]
