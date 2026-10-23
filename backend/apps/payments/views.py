from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.enrollments.serializers import CourseSlugSerializer
from apps.users.permissions import IsStudent

from . import services
from .gateways import InvalidWebhook, UnknownGateway
from .models import Payment
from .serializers import CheckoutResponseSerializer, MockPaySerializer, PaymentSerializer


class CheckoutView(APIView):
    """Start paying for a course. The course unlocks only after the gateway's webhook confirms."""

    permission_classes = [IsStudent]

    @extend_schema(request=CourseSlugSerializer, responses={201: CheckoutResponseSerializer})
    def post(self, request):
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
        return Payment.objects.filter(student=self.request.user).select_related("course")


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
