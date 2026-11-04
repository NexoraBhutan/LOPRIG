from rest_framework import serializers

from apps.courses.models import Course

from .models import Payment, PaymentSettings


class PaymentSerializer(serializers.ModelSerializer):
    course = serializers.CharField(source="course.slug", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False, read_only=True)

    class Meta:
        model = Payment
        fields = [
            "reference", "course", "course_title", "amount", "currency", "provider",
            "status", "failure_reason", "journal_number", "contact_number", "paid_at", "created_at",
        ]


class CheckoutResponseSerializer(serializers.Serializer):
    payment = PaymentSerializer()
    checkout_url = serializers.CharField()


class MockPaySerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=["success", "failure"], default="success")


class QrSettingsSerializer(serializers.ModelSerializer):
    """What students see on the payment page. The QR is meant to be public (it's for scanning)."""

    qr_image = serializers.SerializerMethodField()
    ready = serializers.BooleanField(source="is_ready", read_only=True)

    class Meta:
        model = PaymentSettings
        fields = ["ready", "qr_image", "account_name", "bank_name", "account_number", "instructions"]

    def get_qr_image(self, obj) -> str:
        if not obj.qr_image:
            return ""
        request = self.context.get("request")
        return request.build_absolute_uri(obj.qr_image.url) if request else obj.qr_image.url


class QrSubmitSerializer(serializers.Serializer):
    course = serializers.SlugRelatedField(slug_field="slug", queryset=Course.objects.published())
    journal_number = serializers.CharField(max_length=60)
    contact_number = serializers.CharField(max_length=30)
    proof = serializers.FileField()
