from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.enrollments.serializers import CourseSlugSerializer
from apps.users.permissions import IsStudent

from . import services
from .gateways import InvalidWebhook, UnknownGateway
from .models import Payment, PaymentSettings
from .serializers import (
    BankPaymentSerializer,
    CheckoutResponseSerializer,
    MockPaySerializer,
    PaymentSerializer,
    QrSettingsSerializer,
    QrSubmitSerializer,
)


class CheckoutView(APIView):
    """Start paying for a course. The course unlocks only after the gateway's webhook confirms."""

    permission_classes = [IsStudent]

    @extend_schema(request=CourseSlugSerializer, responses={201: CheckoutResponseSerializer})
    def post(self, request):
        if settings.PAYMENT_PROVIDER == Payment.QR:
            raise ValidationError({"detail": "Pay by scanning the QR code on the course's payment page."})
        serializer = CourseSlugSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment, session = services.start_checkout(request.user, serializer.validated_data["course"])
        body = {"payment": PaymentSerializer(payment).data, "checkout_url": session.checkout_url}
        return Response(body, status=status.HTTP_201_CREATED)


class PaymentListView(generics.ListAPIView):
    queryset = Payment.objects.none()  # schema hint; get_queryset() scopes to the user
    permission_classes = [IsStudent]
    serializer_class = PaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.filter(student=self.request.user).select_related("course")
        if course := self.request.query_params.get("course"):
            qs = qs.filter(course__slug=course)
        return qs


class PaymentDetailView(generics.RetrieveAPIView):
    queryset = Payment.objects.none()  # schema hint; get_queryset() scopes to the user
    permission_classes = [IsStudent]
    serializer_class = PaymentSerializer
    lookup_field = "reference"

    def get_queryset(self):
        return Payment.objects.filter(student=self.request.user).select_related("course")


class PaymentWebhookView(APIView):
    """Called by the payment gateway, not by users. Trust comes from the signature, not a login."""

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, provider):
        try:
            services.handle_webhook(provider, request.body, request.headers)
        except UnknownGateway:
            raise Http404
        except InvalidWebhook as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"received": True})


class MockPayView(APIView):
    """Development only: pretend to be the customer finishing (or failing) payment on the gateway."""

    permission_classes = [IsStudent]

    @extend_schema(request=MockPaySerializer, responses=PaymentSerializer)
    def post(self, request, reference):
        if settings.PAYMENT_PROVIDER != "mock":
            raise Http404
        payment = get_object_or_404(Payment, reference=reference, student=request.user, provider="mock")
        serializer = MockPaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = services.simulate_mock_payment(payment, succeeded=serializer.validated_data["outcome"] == "success")
        return Response(PaymentSerializer(payment).data)


class QrSettingsView(APIView):
    """Lop-rig's bank QR code and account name, shown on the payment page."""

    permission_classes = [AllowAny]

    @extend_schema(responses=QrSettingsSerializer)
    def get(self, request):
        return Response(QrSettingsSerializer(PaymentSettings.load(), context={"request": request}).data)


class QrSubmitView(APIView):
    """The student paid by QR: send the journal number + screenshot. An admin verifies it."""

    permission_classes = [IsStudent]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(request={"multipart/form-data": QrSubmitSerializer}, responses={201: PaymentSerializer})
    def post(self, request):
        serializer = QrSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payment = services.submit_qr_payment(
            request.user, data["course"], data["journal_number"], data["proof"], data["contact_number"]
        )
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class BankPaymentView(APIView):
    """The student paid from their bank account (RMA gateway): record it, email the receipt."""

    permission_classes = [IsStudent]

    @extend_schema(request=BankPaymentSerializer, responses={201: PaymentSerializer})
    def post(self, request):
        serializer = BankPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payment = services.record_bank_payment(
            request.user, data["course"], bank=data["bank"], account_last4=data["account_last4"],
            purpose=data["purpose"], remarks=data["remarks"], transaction_id=data["transaction_id"],
        )
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
