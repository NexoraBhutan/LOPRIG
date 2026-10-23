from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    course = serializers.CharField(source="course.slug", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False, read_only=True)

    class Meta:
        model = Payment
        fields = [
            "reference", "course", "course_title", "amount", "currency", "provider",
            "status", "failure_reason", "paid_at", "created_at",
        ]


class CheckoutResponseSerializer(serializers.Serializer):
    payment = PaymentSerializer()
    checkout_url = serializers.CharField()


class MockPaySerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=["success", "failure"], default="success")
