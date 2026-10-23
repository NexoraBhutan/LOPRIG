import secrets

from django.conf import settings
from django.db import models


def generate_reference() -> str:
    return f"pay_{secrets.token_hex(10)}"


class Payment(models.Model):
    """One checkout attempt. Only a verified gateway webhook can move it to SUCCEEDED."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCEEDED = "SUCCEEDED", "Succeeded"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    reference = models.CharField(max_length=40, unique=True, default=generate_reference, editable=False)
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payments")
    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="payments")
    enrollment = models.ForeignKey("enrollments.Enrollment", on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="BTN")
    provider = models.CharField(max_length=30)
    provider_reference = models.CharField(max_length=120, blank=True, db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    failure_reason = models.CharField(max_length=255, blank=True)
    raw_event = models.JSONField(default=dict, blank=True, help_text="Last verified webhook payload, for audits.")
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payments"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reference} {self.amount} {self.currency} ({self.status})"
